/**
 * PostgreSQL connection pool and query functions for text generation.
 *
 * Ported from cdk/text_generation/src/helpers/chat.py and cdk/text_generation/src/main.py.
 * Uses the same Secrets Manager credentials and RDS Proxy endpoint as the Python Lambda.
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const logger = {
  info: (...args) => console.log(JSON.stringify({ level: 'INFO', message: args.join(' ') })),
  warn: (...args) => console.warn(JSON.stringify({ level: 'WARN', message: args.join(' ') })),
  error: (...args) => console.error(JSON.stringify({ level: 'ERROR', message: args.join(' ') })),
};

let pool = null;

/**
 * Initialize or return the existing PostgreSQL connection pool.
 * Reads credentials from Secrets Manager using the SM_DB_CREDENTIALS env var.
 * @returns {Promise<Pool>}
 */
async function getPool() {
  if (pool) return pool;

  const secretsClient = new SecretsManagerClient({});
  const dbSecretName = process.env.SM_DB_CREDENTIALS;
  const rdsEndpoint = process.env.RDS_PROXY_ENDPOINT;

  if (!dbSecretName || !rdsEndpoint) {
    throw new Error('Database credentials not available (SM_DB_CREDENTIALS or RDS_PROXY_ENDPOINT missing)');
  }

  const secretResponse = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: dbSecretName })
  );
  const secret = JSON.parse(secretResponse.SecretString);

  pool = new Pool({
    host: rdsEndpoint,
    port: secret.port,
    database: secret.dbname,
    user: secret.username,
    password: secret.password,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  });

  pool.on('error', (err) => {
    logger.error('Unexpected pool error:', err.message);
  });

  logger.info('PostgreSQL connection pool initialized');
  return pool;
}

/**
 * Fetch the system prompt for a simulation group.
 * Ported from main.py get_system_prompt().
 * @param {string} simulationGroupId
 * @returns {Promise<string|null>}
 */
async function getSystemPrompt(simulationGroupId) {
  const db = await getPool();
  try {
    const result = await db.query(
      'SELECT system_prompt FROM "simulation_groups" WHERE simulation_group_id = $1',
      [simulationGroupId]
    );
    if (result.rows.length > 0 && result.rows[0].system_prompt) {
      logger.info(`System prompt found for simulation_group_id ${simulationGroupId}`);
      return result.rows[0].system_prompt;
    }
    logger.warn(`No system prompt found for simulation_group_id ${simulationGroupId}`);
    return null;
  } catch (err) {
    logger.error(`Error fetching system prompt: ${err.message}`);
    return null;
  }
}

/**
 * Fetch persona details by persona ID.
 * Ported from main.py get_persona_details().
 * @param {string} personaId
 * @returns {Promise<{personaName: string, personaAge: number, personaPrompt: string, llmCompletion: boolean}|null>}
 */
async function getPersonaDetails(personaId) {
  const db = await getPool();
  try {
    const result = await db.query(
      'SELECT persona_name, persona_age, persona_prompt FROM "personas" WHERE persona_id = $1',
      [personaId]
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      logger.info(`Persona details found for persona_id ${personaId}: ${row.persona_name}`);
      return {
        personaName: row.persona_name,
        personaAge: row.persona_age,
        personaPrompt: row.persona_prompt,
        llmCompletion: true,
      };
    }
    logger.warn(`No persona found for persona_id ${personaId}`);
    return null;
  } catch (err) {
    logger.error(`Error fetching persona details: ${err.message}`);
    return null;
  }
}

/**
 * Save a message to the PostgreSQL messages table.
 * Ported from chat.py save_message_to_db().
 * @param {string} sessionId - chat_id
 * @param {string} userId - Cognito user UUID or persona UUID
 * @param {string} senderType - 'student', 'ai', or 'system'
 * @param {string} messageContent
 * @returns {Promise<string|null>} message_id UUID string or null on failure
 */
async function saveMessageToDb(sessionId, userId, senderType, messageContent) {
  const db = await getPool();
  try {
    const result = await db.query(
      'INSERT INTO "messages" (chat_id, user_id, sender_type, message_content, sent_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING message_id',
      [sessionId, userId, senderType, messageContent]
    );
    const messageId = result.rows[0]?.message_id;
    logger.info(`Message saved: sender_type=${senderType}, message_id=${messageId}`);
    return messageId ? String(messageId) : null;
  } catch (err) {
    logger.error(`Error saving message to database: ${err.message}`);
    return null;
  }
}

/**
 * Fetch all messages for a chat session from the messages table.
 * Ported from chat.py fetch_chat_transcript().
 * @param {string} sessionId
 * @returns {Promise<Array<{sender: string, content: string, timestamp: string}>>}
 */
async function fetchChatTranscript(sessionId) {
  const db = await getPool();
  try {
    const result = await db.query(
      'SELECT sender_type, message_content, sent_at FROM "messages" WHERE chat_id = $1 ORDER BY sent_at ASC',
      [sessionId]
    );
    return result.rows.map((r) => ({
      sender: r.sender_type,
      content: r.message_content,
      timestamp: String(r.sent_at),
    }));
  } catch (err) {
    logger.error(`Error fetching chat transcript: ${err.message}`);
    return [];
  }
}

/**
 * Fetch the student's recommendation from the chats table.
 * Ported from chat.py fetch_recommendation().
 * @param {string} sessionId
 * @returns {Promise<string>}
 */
async function fetchRecommendation(sessionId) {
  const db = await getPool();
  try {
    const result = await db.query(
      'SELECT recommendation FROM "chats" WHERE chat_id = $1',
      [sessionId]
    );
    return result.rows[0]?.recommendation || '';
  } catch (err) {
    logger.error(`Error fetching recommendation: ${err.message}`);
    return '';
  }
}

/**
 * Fetch key questions assigned to a persona/group.
 * Ported from chat.py fetch_key_questions().
 * @param {string} simulationGroupId
 * @param {string} personaId
 * @returns {Promise<Array<{question_id: string, question_text: string, evaluation_criteria: string, is_mandatory: boolean, weight: number}>>}
 */
async function fetchKeyQuestions(simulationGroupId, personaId) {
  const db = await getPool();
  try {
    const result = await db.query(
      `SELECT qb.question_id, qb.question_text, qb.evaluation_criteria, qb.is_mandatory, qb.weight,
              sgq.weight_override
       FROM "simulation_group_questions" sgq
       JOIN "question_bank" qb ON sgq.question_id = qb.question_id
       WHERE sgq.simulation_group_id = $1
         AND (sgq.persona_id = $2 OR sgq.persona_id IS NULL)
         AND qb.is_active = TRUE
       ORDER BY sgq."order" NULLS LAST, qb.question_text`,
      [simulationGroupId, personaId]
    );
    logger.info(`Fetched ${result.rows.length} key questions for group=${simulationGroupId}, persona=${personaId}`);
    return result.rows.map((r) => ({
      question_id: String(r.question_id),
      question_text: r.question_text,
      evaluation_criteria: r.evaluation_criteria,
      is_mandatory: r.is_mandatory,
      weight: r.weight_override != null ? r.weight_override : r.weight,
    }));
  } catch (err) {
    logger.error(`Error fetching key questions: ${err.message}`);
    return [];
  }
}

/**
 * Fetch messages with non-NULL matched_question_ids for a session.
 * Ported from chat.py fetch_tagged_messages().
 * @param {string} sessionId
 * @returns {Promise<Array<{message_id: string, message_content: string, sender_type: string, sent_at: string, matched_question_ids: any}>>}
 */
async function fetchTaggedMessages(sessionId) {
  const db = await getPool();
  try {
    const result = await db.query(
      `SELECT message_id, message_content, sender_type, sent_at, matched_question_ids
       FROM "messages"
       WHERE chat_id = $1 AND matched_question_ids IS NOT NULL
       ORDER BY sent_at ASC`,
      [sessionId]
    );
    return result.rows.map((r) => ({
      message_id: String(r.message_id),
      message_content: r.message_content,
      sender_type: r.sender_type,
      sent_at: String(r.sent_at),
      matched_question_ids: r.matched_question_ids,
    }));
  } catch (err) {
    logger.error(`Error fetching tagged messages for session=${sessionId}: ${err.message}`);
    return [];
  }
}

/**
 * Fetch the debrief prompt for a simulation group.
 * Ported from chat.py fetch_debrief_prompt().
 * @param {string} simulationGroupId
 * @returns {Promise<string>}
 * @throws {Error} if no prompt is configured
 */
async function fetchDebriefPrompt(simulationGroupId) {
  const db = await getPool();
  try {
    const result = await db.query(
      'SELECT debrief_prompt FROM simulation_groups WHERE simulation_group_id = $1',
      [simulationGroupId]
    );
    const prompt = result.rows[0]?.debrief_prompt;
    if (prompt && prompt.trim()) {
      return prompt;
    }
    throw new Error(`No debrief prompt configured for simulation group ${simulationGroupId}`);
  } catch (err) {
    if (err.message.includes('No debrief prompt configured')) throw err;
    logger.error(`Error fetching debrief prompt: ${err.message}`);
    throw new Error(`Failed to fetch debrief prompt for group ${simulationGroupId}: ${err.message}`);
  }
}

/**
 * Resolve the student's user_id from a chat_id via chats → student_interactions → enrollments.
 * Ported from chat.py fetch_student_id_for_chat().
 * @param {string} sessionId
 * @returns {Promise<string>}
 */
async function fetchStudentIdForChat(sessionId) {
  const db = await getPool();
  try {
    const result = await db.query(
      `SELECT e.user_id
       FROM "chats" c
       JOIN "student_interactions" si ON c.student_interaction_id = si.student_interaction_id
       JOIN "enrollments" e ON si.enrollment_id = e.enrollment_id
       WHERE c.chat_id = $1`,
      [sessionId]
    );
    return result.rows[0]?.user_id ? String(result.rows[0].user_id) : '';
  } catch (err) {
    logger.error(`Error fetching student_id for chat: ${err.message}`);
    return '';
  }
}

/**
 * Insert a row into the debriefs table and return the debrief_id.
 * Ported from chat.py save_debrief_to_db().
 * @param {object} params
 * @returns {Promise<string>} debrief_id or empty string on failure
 */
async function saveDebriefToDb({
  sessionId,
  studentId,
  personaId,
  simulationGroupId,
  generatedText,
  missingKeyQuestions,
  reasoningGaps,
  rubricScores,
  totalQuestionsAssigned,
  totalQuestionsAsked,
  totalQuestionsMissed,
  overallScore,
}) {
  const db = await getPool();
  try {
    const result = await db.query(
      `INSERT INTO "debriefs" (
        chat_id, student_id, persona_id, simulation_group_id,
        generated_text, missing_key_questions, reasoning_gaps, rubric_scores,
        total_questions_assigned, total_questions_asked, total_questions_missed,
        overall_score, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING debrief_id`,
      [
        sessionId,
        studentId || null,
        personaId || null,
        simulationGroupId || null,
        generatedText,
        JSON.stringify(missingKeyQuestions),
        reasoningGaps,
        JSON.stringify(rubricScores),
        totalQuestionsAssigned,
        totalQuestionsAsked,
        totalQuestionsMissed,
        overallScore,
      ]
    );
    const debriefId = String(result.rows[0].debrief_id);
    logger.info(`Debrief saved: debrief_id=${debriefId}`);
    return debriefId;
  } catch (err) {
    logger.error(`Error saving debrief: ${err.message}`);
    return '';
  }
}

/**
 * Write per-question rows to question_interactions for analytics.
 * Ported from chat.py save_question_interactions().
 * @param {object} params
 */
async function saveQuestionInteractions({
  debriefId,
  sessionId,
  studentId,
  personaId,
  simulationGroupId,
  questionsAddressed,
  questionsMissed,
  allQuestions,
}) {
  const db = await getPool();
  const addressedSet = new Set(questionsAddressed);

  try {
    for (const q of allQuestions) {
      const qid = q.question_id;
      const wasAsked = addressedSet.has(qid);
      await db.query(
        `INSERT INTO "question_interactions" (
          chat_id, question_id, student_id, persona_id,
          simulation_group_id, was_asked, is_correct, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          sessionId,
          qid,
          studentId || null,
          personaId || null,
          simulationGroupId || null,
          wasAsked,
          wasAsked, // simplified: asked = correct for now
        ]
      );
    }
    logger.info(`Saved ${allQuestions.length} question_interactions`);
  } catch (err) {
    logger.error(`Error saving question_interactions: ${err.message}`);
  }
}

module.exports = {
  getPool,
  getSystemPrompt,
  getPersonaDetails,
  saveMessageToDb,
  fetchChatTranscript,
  fetchRecommendation,
  fetchKeyQuestions,
  fetchTaggedMessages,
  fetchDebriefPrompt,
  fetchStudentIdForChat,
  saveDebriefToDb,
  saveQuestionInteractions,
};
