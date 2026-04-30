/**
 * Debrief pipeline orchestration.
 *
 * Ported from cdk/text_generation/src/helpers/chat.py generate_debrief().
 *
 * Implements the multi-step pipeline:
 *   (a) Gather context (transcript, recommendation, key questions, answer key)
 *   (b) Build questions from matched data via buildQuestionsFromMatchedData()
 *   (c) Compute score via computeOverallScore()
 *   (d) LLM summary/feedback call
 *   (e) Generate rewrites for moderate matches
 *   (f) Answer key comparison
 *   (g) Assemble, validate, and persist
 *
 * Calls progressCallback(stage) at each pipeline stage so the handler
 * can emit debrief-progress events.
 */

const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');

const {
  fetchChatTranscript,
  fetchRecommendation,
  fetchKeyQuestions,
  fetchTaggedMessages,
  fetchDebriefPrompt,
  fetchStudentIdForChat,
  saveDebriefToDb,
  saveQuestionInteractions,
} = require('./db');

const { getCachedKeyQuestions, flushMatchingPromises } = require('./matching');
const { invokeModelJson } = require('./bedrock');
const { buildSummaryFeedbackPrompt, buildRewritePrompt, buildAnswerKeyPrompt } = require('./prompts');

const logger = {
  info: (...args) => console.log(JSON.stringify({ level: 'INFO', message: args.join(' ') })),
  warn: (...args) => console.warn(JSON.stringify({ level: 'WARN', message: args.join(' ') })),
  error: (...args) => console.error(JSON.stringify({ level: 'ERROR', message: args.join(' ') })),
};

// ─── Supported answer key file extensions ───────────────────────────────────

const SUPPORTED_ANSWER_KEY_EXTENSIONS = new Set([
  'pdf', 'docx', 'pptx', 'txt', 'xlsx', 'xps', 'mobi', 'cbz',
]);

// ─── Answer Key Retrieval ───────────────────────────────────────────────────

/**
 * Retrieve and extract text from all answer key files in S3.
 * Ported from chat.py retrieve_answer_key_text().
 *
 * Note: For the Node.js port, we only support plain text (.txt) files
 * directly. PDF/DOCX extraction would require additional dependencies.
 * Non-txt files are logged as warnings and skipped.
 *
 * @param {string} simulationGroupId
 * @param {string} personaId
 * @returns {Promise<string>} Concatenated text or empty string
 */
async function retrieveAnswerKeyText(simulationGroupId, personaId) {
  const bucketName = process.env.EMBEDDING_STORAGE_BUCKET;
  if (!bucketName) {
    logger.warn('EMBEDDING_STORAGE_BUCKET environment variable is not set; skipping answer key retrieval');
    return '';
  }

  const prefix = `${simulationGroupId}/${personaId}/answer_key/`;
  const s3 = new S3Client({});

  let contents;
  try {
    const listResponse = await s3.send(new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
    }));
    contents = listResponse.Contents || [];
  } catch (err) {
    logger.error(`Error listing answer key objects at s3://${bucketName}/${prefix}: ${err.message}`);
    return '';
  }

  if (contents.length === 0) {
    logger.info(`No answer key files found at s3://${bucketName}/${prefix}`);
    return '';
  }

  const allText = [];
  for (const obj of contents) {
    const key = obj.Key || '';
    const ext = key.includes('.') ? key.split('.').pop().toLowerCase() : '';

    if (!SUPPORTED_ANSWER_KEY_EXTENSIONS.has(ext)) {
      logger.warn(`Skipping answer key file with unsupported extension: s3://${bucketName}/${key} (ext=${ext})`);
      continue;
    }

    try {
      const getResponse = await s3.send(new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      }));

      // Read the body stream to a buffer
      const chunks = [];
      for await (const chunk of getResponse.Body) {
        chunks.push(chunk);
      }
      const fileBytes = Buffer.concat(chunks);

      if (ext === 'txt') {
        const text = fileBytes.toString('utf-8');
        if (text) {
          allText.push(text);
        }
      } else {
        // For non-txt files, log a warning. Full extraction (PDF, DOCX, etc.)
        // would require additional dependencies like pdf-parse or mammoth.
        // The Python Lambda uses PyMuPDF for this.
        logger.warn(
          `Answer key file s3://${bucketName}/${key} is ${ext} format. ` +
          `Only .txt files are supported in the socket server. ` +
          `Size: ${fileBytes.length} bytes.`
        );
      }
    } catch (err) {
      logger.error(`Error processing answer key file s3://${bucketName}/${key}: ${err.message}`);
    }
  }

  return allText.join('');
}

// ─── Build Questions from Matched Data ──────────────────────────────────────

/**
 * Build questions_addressed and questions_missed deterministically from
 * pre-matched embedding data — no LLM involved.
 *
 * Ported from chat.py build_questions_from_matched_data().
 *
 * @param {Array<object>} taggedMessages - Messages with matched_question_ids
 * @param {Array<object>} keyQuestions - Key questions from DB/cache
 * @returns {{questionsAddressed: Array<object>, questionsMissed: Array<object>}}
 */
function buildQuestionsFromMatchedData(taggedMessages, keyQuestions) {
  // Lookup key questions by question_id
  const questionMap = new Map();
  for (const q of keyQuestions) {
    questionMap.set(q.question_id, q);
  }

  // Group tagged messages by matched question_id
  const addressed = new Map(); // question_id -> list of match info

  for (const msg of taggedMessages) {
    let matches = msg.matched_question_ids || [];
    // matched_question_ids may be a JSON string or already an array
    if (typeof matches === 'string') {
      try {
        matches = JSON.parse(matches);
      } catch {
        matches = [];
      }
    }

    for (const match of matches) {
      const qid = match.question_id || '';
      if (!qid) continue;

      const score = match.similarity_score || 0.0;
      const confidence = match.confidence || 'moderate';

      if (!addressed.has(qid)) {
        addressed.set(qid, []);
      }
      addressed.get(qid).push({
        message_content: msg.message_content || '',
        similarity_score: score,
        confidence_tier: confidence,
      });
    }
  }

  // Build questions_addressed list
  const questionsAddressed = [];
  for (const [qid, matchedMessages] of addressed) {
    const q = questionMap.get(qid) || {};
    questionsAddressed.push({
      question_id: qid,
      question_text: q.question_text || qid,
      matched_messages: matchedMessages,
      quality_assessment: 'Matched via automated embedding analysis.',
    });
  }

  // Build questions_missed list
  const addressedIds = new Set(addressed.keys());
  const questionsMissed = keyQuestions
    .filter((q) => !addressedIds.has(q.question_id))
    .map((q) => ({
      question_id: q.question_id,
      question_text: q.question_text || '',
      is_mandatory: q.is_mandatory || false,
      weight: q.weight || 1.0,
    }));

  return { questionsAddressed, questionsMissed };
}

// ─── Compute Overall Score ──────────────────────────────────────────────────

/**
 * Compute a deterministic overall debrief score from question weights and
 * mandatory flags — no LLM involved.
 *
 * Score = (sum of weights for addressed questions / sum of all weights) × 100,
 * capped at mandatoryCap (default 90) if any mandatory question was missed.
 *
 * Ported from chat.py compute_overall_score().
 *
 * @param {Array<object>} keyQuestions
 * @param {Set<string>} addressedQuestionIds
 * @param {number} [mandatoryCap=90.0]
 * @returns {number} Score in [0.0, 100.0]
 */
function computeOverallScore(keyQuestions, addressedQuestionIds, mandatoryCap = 90.0) {
  if (!keyQuestions || keyQuestions.length === 0) return 0.0;

  const totalWeight = keyQuestions.reduce((sum, q) => sum + (q.weight || 1.0), 0);
  if (totalWeight === 0) return 0.0;

  const addressedWeight = keyQuestions
    .filter((q) => addressedQuestionIds.has(q.question_id))
    .reduce((sum, q) => sum + (q.weight || 1.0), 0);

  let score = (addressedWeight / totalWeight) * 100.0;

  // Apply mandatory penalty: cap score if any mandatory question is missed
  const hasMissedMandatory = keyQuestions.some(
    (q) => q.is_mandatory && !addressedQuestionIds.has(q.question_id)
  );
  if (hasMissedMandatory) {
    score = Math.min(score, mandatoryCap);
  }

  // Clamp to [0.0, 100.0] and round to whole number
  return Math.round(Math.max(0.0, Math.min(score, 100.0)));
}

// ─── Validate Debrief Output ────────────────────────────────────────────────

/**
 * Validate and repair an Enhanced Debrief dict from the LLM.
 * Ported from chat.py validate_debrief_output().
 *
 * @param {object} data - The parsed LLM JSON output (may be incomplete)
 * @param {boolean} [answerKeyProvided=false]
 * @returns {object} Validated/repaired dict
 */
function validateDebriefOutput(data, answerKeyProvided = false) {
  let repaired = false;

  // Top-level defaults
  const topLevelDefaults = {
    summary: '',
    questions_addressed: [],
    questions_missed: [],
    recommendation_feedback: { strengths: [], areas_for_improvement: [] },
    reasoning_gaps: '',
    overall_score: 0.0,
    suggested_rewrites: [],
  };

  for (const [key, defaultVal] of Object.entries(topLevelDefaults)) {
    if (!(key in data)) {
      logger.warn(`Debrief validation: missing top-level key '${key}', filling with default`);
      data[key] = defaultVal;
      repaired = true;
    }
  }

  // Validate overall_score type
  if (typeof data.overall_score !== 'number') {
    logger.warn("Debrief validation: 'overall_score' is not numeric, resetting to 0.0");
    data.overall_score = 0.0;
    repaired = true;
  } else {
    data.overall_score = Math.round(data.overall_score);
  }

  // Validate recommendation_feedback structure
  const rec = data.recommendation_feedback;
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
    logger.warn("Debrief validation: 'recommendation_feedback' is not a dict, resetting");
    data.recommendation_feedback = { strengths: [], areas_for_improvement: [] };
    repaired = true;
  } else {
    if (!Array.isArray(rec.strengths)) {
      rec.strengths = [];
      repaired = true;
    }
    if (!Array.isArray(rec.areas_for_improvement)) {
      rec.areas_for_improvement = [];
      repaired = true;
    }
  }

  // Validate questions_addressed entries
  if (!Array.isArray(data.questions_addressed)) {
    data.questions_addressed = [];
    repaired = true;
  } else {
    for (let i = 0; i < data.questions_addressed.length; i++) {
      const entry = data.questions_addressed[i];
      if (!entry || typeof entry !== 'object') {
        data.questions_addressed[i] = { question_id: '', question_text: '', matched_messages: [], quality_assessment: '' };
        repaired = true;
        continue;
      }
      if (!('question_id' in entry)) { entry.question_id = ''; repaired = true; }
      if (!('question_text' in entry)) { entry.question_text = ''; repaired = true; }
      if (!('matched_messages' in entry)) { entry.matched_messages = []; repaired = true; }
      if (!('quality_assessment' in entry)) { entry.quality_assessment = ''; repaired = true; }
    }
  }

  // Validate questions_missed entries
  if (!Array.isArray(data.questions_missed)) {
    data.questions_missed = [];
    repaired = true;
  } else {
    for (let i = 0; i < data.questions_missed.length; i++) {
      const entry = data.questions_missed[i];
      if (!entry || typeof entry !== 'object') {
        data.questions_missed[i] = { question_id: '', question_text: '', is_mandatory: false, weight: 1.0 };
        repaired = true;
        continue;
      }
      if (!('question_id' in entry)) { entry.question_id = ''; repaired = true; }
      if (!('question_text' in entry)) { entry.question_text = ''; repaired = true; }
      if (!('is_mandatory' in entry)) { entry.is_mandatory = false; repaired = true; }
      if (!('weight' in entry)) { entry.weight = 1.0; repaired = true; }
    }
  }

  // Validate suggested_rewrites entries
  if (!Array.isArray(data.suggested_rewrites)) {
    data.suggested_rewrites = [];
    repaired = true;
  } else {
    for (let i = 0; i < data.suggested_rewrites.length; i++) {
      const entry = data.suggested_rewrites[i];
      if (!entry || typeof entry !== 'object') {
        data.suggested_rewrites[i] = { original_message: '', matched_question_id: '', similarity_score: 0.0, suggested_rewrite: '' };
        repaired = true;
        continue;
      }
      if (!('original_message' in entry)) { entry.original_message = ''; repaired = true; }
      if (!('matched_question_id' in entry)) { entry.matched_question_id = ''; repaired = true; }
      if (!('similarity_score' in entry)) { entry.similarity_score = 0.0; repaired = true; }
      if (!('suggested_rewrite' in entry)) { entry.suggested_rewrite = ''; repaired = true; }
    }
  }

  // Validate answer_key_comparison
  if (answerKeyProvided) {
    const akc = data.answer_key_comparison;
    if (!akc || typeof akc !== 'object' || Array.isArray(akc)) {
      data.answer_key_comparison = {
        answer_key_available: true,
        correct_elements: [],
        missing_elements: [],
        incorrect_elements: [],
        overall_alignment: '',
      };
      repaired = true;
    } else {
      if (typeof akc.answer_key_available !== 'boolean') { akc.answer_key_available = true; repaired = true; }
      if (!Array.isArray(akc.correct_elements)) { akc.correct_elements = []; repaired = true; }
      if (!Array.isArray(akc.missing_elements)) { akc.missing_elements = []; repaired = true; }
      if (!Array.isArray(akc.incorrect_elements)) { akc.incorrect_elements = []; repaired = true; }
      if (typeof akc.overall_alignment !== 'string') { akc.overall_alignment = ''; repaired = true; }
    }
  } else {
    data.answer_key_comparison = { answer_key_available: false };
  }

  if (repaired) {
    logger.warn('Debrief output was repaired — some fields were missing or malformed');
  }

  return data;
}

// ─── Generate Debrief ───────────────────────────────────────────────────────

/**
 * Orchestrate the full debrief generation flow.
 * Ported from chat.py generate_debrief().
 *
 * @param {string} sessionId
 * @param {string} simulationGroupId
 * @param {string} personaId
 * @param {Function} progressCallback - Called with (stage: string) at each pipeline stage
 * @param {object} [options]
 * @param {string} [options.modelId] - Bedrock model ID (defaults to BEDROCK_MODEL_ID env var)
 * @param {string} [options.region='us-east-1'] - AWS region for Bedrock
 * @param {string} [options.ddbTableName] - DynamoDB table name (defaults to DYNAMODB_TABLE_NAME env var)
 * @returns {Promise<object>} The debrief data object
 */
async function generateDebrief(sessionId, simulationGroupId, personaId, progressCallback, options = {}) {
  const modelId = options.modelId || process.env.BEDROCK_MODEL_ID;
  const region = options.region || 'us-east-1';
  const ddbTableName = options.ddbTableName || process.env.DYNAMODB_TABLE_NAME;

  logger.info(`DEBRIEF GENERATION STARTED for session=${sessionId}`);

  // Wait for any in-flight matching promises so that all
  // matched_question_ids are persisted before we query for them.
  await flushMatchingPromises(sessionId);

  // ── Stage 1: Gather context ───────────────────────────────────────────
  progressCallback('Gathering transcript and context');

  const [transcript, recommendation, keyQuestions, studentId, answerKeyText, debriefPrompt] =
    await Promise.all([
      fetchChatTranscript(sessionId),
      fetchRecommendation(sessionId),
      fetchKeyQuestions(simulationGroupId, personaId),
      fetchStudentIdForChat(sessionId),
      retrieveAnswerKeyText(simulationGroupId, personaId),
      fetchDebriefPrompt(simulationGroupId),
    ]);

  if (!transcript || transcript.length === 0) {
    logger.error('No transcript found — cannot generate debrief');
    throw new Error('No chat transcript found');
  }

  // ── Stage 2: Analyze matched questions ────────────────────────────────
  progressCallback('Analyzing question coverage');

  const taggedMessages = await fetchTaggedMessages(sessionId);

  let debriefData;

  if (taggedMessages && taggedMessages.length > 0) {
    logger.info(`Found ${taggedMessages.length} tagged messages — using multi-step debrief pipeline`);

    // Get key questions from DynamoDB cache first, fall back to PostgreSQL
    let cachedQuestions = null;
    if (ddbTableName) {
      cachedQuestions = await getCachedKeyQuestions(sessionId, ddbTableName);
    }
    if (!cachedQuestions) {
      logger.info('Cache miss or unavailable — using key questions from PostgreSQL');
      cachedQuestions = keyQuestions;
    }

    // Step a: Build questions deterministically from pre-matched data
    const { questionsAddressed, questionsMissed } = buildQuestionsFromMatchedData(taggedMessages, cachedQuestions);

    // Step b: Compute overall score deterministically
    const addressedIdsSet = new Set(questionsAddressed.map((q) => q.question_id));
    const overallScore = computeOverallScore(cachedQuestions, addressedIdsSet);

    // ── Stage 3: LLM summary/feedback ─────────────────────────────────
    progressCallback('Generating summary and feedback');

    const summaryPrompt = buildSummaryFeedbackPrompt(transcript, questionsAddressed, questionsMissed, recommendation);
    const summaryData = await invokeModelJson(modelId, debriefPrompt, summaryPrompt, 2, region);
    logger.info(`Summary/feedback LLM call returned keys: ${Object.keys(summaryData).join(', ')}`);

    // ── Stage 4: Generate rewrites for moderate matches ─────────────
    progressCallback('Generating improvement suggestions');

    const REWRITE_THRESHOLD = 0.70;
    const suggestedRewrites = [];
    const questionMap = new Map(cachedQuestions.map((q) => [q.question_id, q]));

    for (const qaEntry of questionsAddressed) {
      for (const msgMatch of qaEntry.matched_messages || []) {
        if ((msgMatch.similarity_score || 1.0) < REWRITE_THRESHOLD) {
          const q = questionMap.get(qaEntry.question_id) || {};
          const rewritePrompt = buildRewritePrompt(
            msgMatch.message_content,
            qaEntry.question_text,
            q.evaluation_criteria || ''
          );
          const rewriteData = await invokeModelJson(modelId, debriefPrompt, rewritePrompt, 2, region);
          const rewriteText = (rewriteData.suggested_rewrite || '').trim();
          if (rewriteText) {
            suggestedRewrites.push({
              original_message: msgMatch.message_content,
              matched_question_id: qaEntry.question_id,
              similarity_score: msgMatch.similarity_score || 0.0,
              suggested_rewrite: rewriteText,
            });
          }
        }
      }
    }
    logger.info(`Generated ${suggestedRewrites.length} suggested rewrites`);

    // ── Stage 5: Answer key comparison ──────────────────────────────
    progressCallback('Comparing with answer key');

    let answerKeyComparison;
    if (answerKeyText) {
      const akPrompt = buildAnswerKeyPrompt(recommendation, answerKeyText);
      answerKeyComparison = await invokeModelJson(modelId, debriefPrompt, akPrompt, 2, region);
      if (!('answer_key_available' in answerKeyComparison)) {
        answerKeyComparison.answer_key_available = true;
      }
      logger.info(`Answer key comparison LLM call returned keys: ${Object.keys(answerKeyComparison).join(', ')}`);
    } else {
      answerKeyComparison = { answer_key_available: false };
    }

    // Step f: Assemble final debrief dict
    debriefData = {
      summary: summaryData.summary || '',
      questions_addressed: questionsAddressed,
      questions_missed: questionsMissed,
      recommendation_feedback: summaryData.recommendation_feedback || { strengths: [], areas_for_improvement: [] },
      reasoning_gaps: summaryData.reasoning_gaps || '',
      overall_score: overallScore,
      suggested_rewrites: suggestedRewrites,
      answer_key_comparison: answerKeyComparison,
      recommendation,
    };
  } else {
    logger.info('No tagged messages found — falling back to full-transcript debrief');

    // Full-transcript fallback (original behavior)
    const transcriptText = transcript
      .map((m) => `[${(m.sender || 'UNKNOWN').toUpperCase()}]: ${m.content || ''}`)
      .join('\n');

    const keyQuestionsText = keyQuestions.length > 0
      ? keyQuestions
          .map((q) => `- [${q.question_id}] (mandatory=${q.is_mandatory}, weight=${q.weight}): ${q.question_text}`)
          .join('\n')
      : 'No key questions were assigned for this patient.';

    let userPrompt = `
## Chat Transcript
${transcriptText}

## Student's Recommendation
${recommendation || '(No recommendation submitted)'}

## Key Questions
${keyQuestionsText}

Please evaluate the student's performance and produce the JSON debrief.
`;

    if (answerKeyText) {
      userPrompt += `
## Answer Key

The following is the instructor's answer key for this simulation case. Compare the student's recommendation against this answer key and populate the answer_key_comparison field accordingly.

${answerKeyText}
`;
    }

    // Call the LLM with retry on invalid JSON (fallback path)
    progressCallback('Generating summary and feedback');
    debriefData = await invokeModelJson(modelId, debriefPrompt, userPrompt, 2, region);

    if (!debriefData || Object.keys(debriefData).length === 0) {
      logger.error('All debrief LLM attempts failed to produce valid JSON — using fallback');
      debriefData = {
        summary: '',
        questions_addressed: [],
        questions_missed: [],
        recommendation_feedback: { strengths: [], areas_for_improvement: [] },
        reasoning_gaps: '',
        overall_score: 0.0,
        suggested_rewrites: [],
      };
    }
  }

  // ── Stage 6: Assemble, validate, and persist ──────────────────────────
  progressCallback('Finalizing debrief');

  // Validate and repair the debrief output schema
  debriefData = validateDebriefOutput(debriefData, !!answerKeyText);

  // Include the student's recommendation
  if (!('recommendation' in debriefData)) {
    debriefData.recommendation = recommendation;
  }

  const questionsAddressed = debriefData.questions_addressed || [];
  const questionsMissed = debriefData.questions_missed || [];
  const totalAssigned = keyQuestions.length;
  const totalAsked = questionsAddressed.length;
  const totalMissed = questionsMissed.length;

  // Recompute score deterministically when key_questions are available
  if (keyQuestions.length > 0 && questionsAddressed.length > 0) {
    const addrIdsForScore = new Set();
    for (const item of questionsAddressed) {
      if (item && typeof item === 'object' && item.question_id) {
        addrIdsForScore.add(item.question_id);
      }
    }
    if (addrIdsForScore.size > 0) {
      debriefData.overall_score = computeOverallScore(keyQuestions, addrIdsForScore);
    }
  }

  const overallScore = debriefData.overall_score || 0.0;

  // Extract question IDs for analytics
  const extractIds = (items) => {
    return (items || [])
      .map((item) => (typeof item === 'object' ? item.question_id : String(item)))
      .filter(Boolean);
  };

  const addressedIds = extractIds(questionsAddressed);
  const missedIds = extractIds(questionsMissed);

  // Write to debriefs table
  const debriefId = await saveDebriefToDb({
    sessionId,
    studentId,
    personaId,
    simulationGroupId,
    generatedText: JSON.stringify(debriefData),
    missingKeyQuestions: questionsMissed,
    reasoningGaps: debriefData.reasoning_gaps || '',
    rubricScores: debriefData.recommendation_feedback || {},
    totalQuestionsAssigned: totalAssigned,
    totalQuestionsAsked: totalAsked,
    totalQuestionsMissed: totalMissed,
    overallScore,
  });

  // Write per-question analytics
  if (keyQuestions.length > 0 && studentId) {
    await saveQuestionInteractions({
      debriefId,
      sessionId,
      studentId,
      personaId,
      simulationGroupId,
      questionsAddressed: addressedIds,
      questionsMissed: missedIds,
      allQuestions: keyQuestions,
    });
  }

  logger.info(`DEBRIEF GENERATION COMPLETE for session=${sessionId}, score=${overallScore}`);
  return debriefData;
}

module.exports = {
  retrieveAnswerKeyText,
  buildQuestionsFromMatchedData,
  computeOverallScore,
  validateDebriefOutput,
  generateDebrief,
};
