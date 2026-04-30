# AI Debrief Generation — Deep Dive

This document provides a comprehensive technical walkthrough of how the AI debrief system works end-to-end, from the moment a student concludes a simulation to the final rendered feedback in the UI.

---

## Table of Contents

1. [High-Level Architecture](#high-level-architecture)
2. [Triggering Debrief Generation](#triggering-debrief-generation)
3. [Real-Time Question Matching (During Chat)](#real-time-question-matching-during-chat)
4. [The Text Generation Lambda — Debrief Mode](#the-text-generation-lambda--debrief-mode)
5. [The `generate_debrief()` Orchestrator](#the-generate_debrief-orchestrator)
6. [Context Gathering](#context-gathering)
7. [The Two Debrief Paths](#the-two-debrief-paths)
   - [Enhanced Path (Tagged Messages)](#enhanced-path-tagged-messages)
   - [Fallback Path (Full Transcript)](#fallback-path-full-transcript)
8. [Debrief Prompt System](#debrief-prompt-system)
9. [Schema Validation and Repair](#schema-validation-and-repair)
10. [Persistence Layer](#persistence-layer)
11. [Real-Time Delivery via AppSync](#real-time-delivery-via-appsync)
12. [Frontend Retrieval and Polling](#frontend-retrieval-and-polling)
13. [Frontend JSON Parsing and Repair](#frontend-json-parsing-and-repair)
14. [Frontend Rendering (AIDebriefDialog)](#frontend-rendering-aidebriefDialog)
15. [Debrief Feedback Collection](#debrief-feedback-collection)
16. [Instructor/Admin Debrief Viewing](#instructoradmin-debrief-viewing)
17. [Test Debrief (Prompt Playground)](#test-debrief-prompt-playground)
18. [Database Schema](#database-schema)
19. [Key Files Reference](#key-files-reference)

---

## High-Level Architecture

```
Student clicks "Conclude" in chat UI
        │
        ▼
┌─────────────────────────────┐
│  ConfirmConcludeDialog      │  Student enters recommendation text
│  (frontend)                 │
└──────────┬──────────────────┘
           │ POST /student/conclude_interaction
           ▼
┌─────────────────────────────┐
│  Student Lambda              │  1. Saves recommendation to chats table
│  (studentFunction.js)        │  2. Marks chat as 'concluded'
│                              │  3. Marks student_interaction as completed
│                              │  4. Logs engagement event
│                              │  5. Invokes Text Gen Lambda (async)
└──────────┬──────────────────┘
           │ InvocationType: "Event" (fire-and-forget)
           ▼
┌─────────────────────────────┐
│  Text Generation Lambda      │  mode=debrief
│  (main.py)                   │
│    └─ generate_debrief()     │  Orchestrates the full pipeline
│       (chat.py)              │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  PostgreSQL (debriefs table) │  Persists generated_text JSON
│  + question_interactions     │  Per-question analytics
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  AppSync (publishTextStream) │  Real-time push to frontend
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│  Frontend polls GET          │  Exponential backoff polling
│  /student/get_debrief        │  until debrief row appears
│    └─ AIDebriefDialog        │  Renders structured feedback
└─────────────────────────────┘
```

---

## Triggering Debrief Generation

**File:** `cdk/lambda/lib/studentFunction.js` — `POST /student/conclude_interaction`

When a student decides they have enough information, they click "Conclude" in the chat UI. This opens the `ConfirmConcludeDialog` component, which first asks for confirmation, then prompts the student to enter their clinical recommendation/diagnosis.

The frontend sends a POST request with query parameters (`session_id`, `simulation_group_id`, `patient_id`) and a JSON body containing the `recommendation` text.

The Lambda handler performs these steps in order:

1. **Save recommendation** — Updates the `chats` row: sets `recommendation`, `ended_at = CURRENT_TIMESTAMP`, `status = 'concluded'`
2. **Mark interaction complete** — Sets `is_completed = TRUE` on the parent `student_interactions` row
3. **Log engagement** — Inserts a `chat_concluded` event into `user_engagement_log`
4. **Invoke debrief generation asynchronously** — Uses the AWS Lambda SDK to invoke the text generation Lambda with `InvocationType: "Event"` (fire-and-forget). The payload includes `mode: "debrief"` along with the session, group, and patient IDs

The conclude endpoint returns immediately to the student with `{ debrief_triggered: true }`. The debrief generation happens entirely in the background — if the async invocation fails, it's logged but doesn't block the conclude response.

```javascript
const debriefPayload = {
  queryStringParameters: {
    simulation_group_id: simulationGroupId,
    session_id: sessionId,
    patient_id: patientId,
    mode: "debrief",
  },
  headers: event.headers,
  requestContext: event.requestContext,
  body: JSON.stringify({ recommendation }),
};

const invokeCommand = new InvokeCommand({
  FunctionName: textGenFunctionName,
  InvocationType: "Event", // Async — fire and forget
  Payload: JSON.stringify(debriefPayload),
});
```

---

## Real-Time Question Matching (During Chat)

Before debrief generation even begins, the system has been doing work during the live chat session. Every time a student sends a message, the text generation Lambda runs **semantic matching** in a background thread.

**File:** `cdk/text_generation/src/helpers/chat.py` — `match_message_to_questions()`, `run_matching_async()`

### How It Works

1. **Key questions are cached at session start** — When the first message in a session arrives, `cache_key_questions()` fetches the key questions from PostgreSQL (via `simulation_group_questions` + `question_bank`), computes embeddings for each question using the Cohere embeddings model, and stores them in DynamoDB keyed by `QCACHE#{session_id}`.

2. **Each student message is matched asynchronously** — `run_matching_async()` spawns a daemon thread that:
   - Embeds the student's message using the same Cohere model
   - Computes cosine similarity against every cached question embedding
   - Classifies matches into confidence tiers:
     - **High:** similarity ≥ 0.65
     - **Moderate:** similarity 0.55–0.64
     - **Low:** similarity 0.40–0.54
     - **Discarded:** similarity < 0.40
   - Writes the `matched_question_ids` JSONB array to the `messages` table for that message

3. **Thread tracking** — All matching threads are tracked per session in a global dict (`_matching_threads`). Before debrief generation starts, `flush_matching_threads()` joins all pending threads (with a 30-second timeout per thread) to ensure every message has its matches persisted.

### Match Data Structure

Each entry in `matched_question_ids` on a message row looks like:

```json
{
  "question_id": "uuid",
  "similarity_score": 0.72,
  "confidence": "high"
}
```

---

## The Text Generation Lambda — Debrief Mode

**File:** `cdk/text_generation/src/main.py`

The text generation Lambda is a multi-mode function. When invoked with `mode=debrief`, it:

1. Extracts `session_id`, `simulation_group_id`, and `persona_id` from query parameters
2. Initializes a **non-streaming** Bedrock LLM (`ChatBedrock` with `streaming=False`) — debrief doesn't stream tokens
3. Initializes the Cohere embeddings model (used for DynamoDB cache lookups)
4. Calls `generate_debrief()` and returns the result

```python
llm = get_bedrock_llm(bedrock_llm_id=BEDROCK_LLM_ID, streaming=False)
debrief_result = generate_debrief(
    session_id=session_id,
    simulation_group_id=simulation_group_id,
    persona_id=persona_id,
    llm=llm,
    embeddings_model=embeddings,
    ddb_table_name=TABLE_NAME,
)
```

---

## The `generate_debrief()` Orchestrator

**File:** `cdk/text_generation/src/helpers/chat.py`

This is the core function that orchestrates the entire debrief pipeline. It follows this flow:

```
flush_matching_threads()
        │
        ▼
  Gather Context (transcript, recommendation, key questions, answer key, debrief prompt)
        │
        ▼
  fetch_tagged_messages()
        │
        ├── Tagged messages exist? ──► Enhanced Path (multi-step pipeline)
        │
        └── No tagged messages? ────► Fallback Path (single LLM call)
        │
        ▼
  validate_debrief_output()
        │
        ▼
  Recompute score deterministically
        │
        ▼
  save_debrief_to_db()
        │
        ▼
  save_question_interactions()
        │
        ▼
  publish_to_appsync()
```

---

## Context Gathering

Before choosing a debrief path, the function gathers all necessary context:

### 1. `fetch_chat_transcript(session_id)`
Queries the `messages` table for all messages in the session, ordered by `sent_at ASC`. Returns a list of `{sender, content, timestamp}` dicts.

### 2. `fetch_recommendation(session_id)`
Reads the `recommendation` column from the `chats` table for this session.

### 3. `fetch_key_questions(simulation_group_id, persona_id)`
Joins `simulation_group_questions` with `question_bank` to get the expected questions for this patient/group combination. Returns question_id, question_text, evaluation_criteria, is_mandatory, and weight (with `weight_override` taking precedence over the base weight).

### 4. `retrieve_answer_key_text(simulation_group_id, persona_id)`
Looks for answer key files in S3 at the path `{simulation_group_id}/{persona_id}/answer_key/`. Supports PDF, DOCX, PPTX, TXT, XLSX, XPS, MOBI, and CBZ formats. Uses PyMuPDF to extract text from each file and concatenates the results. Returns an empty string if no answer key exists.

### 5. `fetch_debrief_prompt(simulation_group_id)`
Reads the `debrief_prompt` column from the `simulation_groups` table. This is the system prompt used for all LLM calls during debrief generation. There is **no fallback to a hardcoded constant** — if the column is NULL or empty, a `ValueError` is raised.

### 6. `fetch_tagged_messages(session_id)`
Queries messages with non-NULL `matched_question_ids` for this session. These are the messages that were semantically matched to key questions during the live chat.

### 7. `fetch_student_id_for_chat(session_id)`
Resolves the student's `user_id` by traversing `chats → student_interactions → enrollments`.

---

## The Two Debrief Paths

The system uses two distinct strategies depending on whether real-time question matching produced results.

### Enhanced Path (Tagged Messages)

Used when `fetch_tagged_messages()` returns results — meaning the embedding-based matcher successfully tagged student messages during the chat. This is the preferred path because it produces more deterministic, consistent results.

The enhanced path is a **multi-step pipeline** with 6 stages:

#### Step A: Build Questions Deterministically

**Function:** `build_questions_from_matched_data(tagged_messages, cached_questions)`

No LLM involved. Groups tagged messages by their matched question IDs and produces two lists:

- **`questions_addressed`** — Each entry contains the question_id, question_text, a list of matched_messages (with content, similarity_score, confidence_tier), and a quality_assessment note
- **`questions_missed`** — Key questions with no matching messages, including is_mandatory and weight

#### Step B: Compute Overall Score Deterministically

**Function:** `compute_overall_score(key_questions, addressed_question_ids)`

No LLM involved. Pure math:

```
score = (sum of weights for addressed questions / sum of all weights) × 100
```

**Mandatory penalty:** If any mandatory question was missed, the score is capped at 90.0 regardless of the raw calculation. The final score is rounded to a whole number and clamped to [0.0, 100.0].

#### Step C: LLM Call — Summary and Feedback

**Function:** `build_summary_feedback_prompt()` → `_invoke_llm_json()`

The LLM receives the full transcript and the pre-computed question lists as **read-only context**. It is explicitly told NOT to re-evaluate question matching or compute a score. It generates only:

- `summary` — A 3-5 sentence overall performance summary
- `recommendation_feedback` — `{ strengths: [...], areas_for_improvement: [...] }`
- `reasoning_gaps` — A paragraph describing gaps in clinical reasoning

This focused prompt keeps the LLM output small (~500-800 tokens) and reduces the chance of JSON parse failures.

#### Step D: LLM Calls — Suggested Rewrites

**Function:** `build_rewrite_prompt()` → `_invoke_llm_json()` (called per match)

For each matched message with a similarity score below the `REWRITE_THRESHOLD` (0.65), the system makes a separate LLM call to generate a suggested rewrite. Each call produces a single JSON object:

```json
{ "suggested_rewrite": "The improved version of the student's message." }
```

The rewrite prompt includes the original message, the matched question text, and the evaluation criteria. The LLM is asked to keep the student's conversational tone while making the question more specific and targeted.

#### Step E: LLM Call — Answer Key Comparison

**Function:** `build_answer_key_prompt()` → `_invoke_llm_json()`

Only called when `answer_key_text` is non-empty (i.e., an answer key file exists in S3). The LLM compares the student's recommendation against the answer key and produces:

```json
{
  "answer_key_available": true,
  "correct_elements": ["..."],
  "missing_elements": ["..."],
  "incorrect_elements": ["..."],
  "overall_alignment": "Strong | Partial | Weak"
}
```

If no answer key exists, this step is skipped and `answer_key_comparison` is set to `{ "answer_key_available": false }`.

#### Step F: Assemble Final Debrief

All pieces are combined into the final debrief dict:

```python
debrief_data = {
    "summary": summary_data.get("summary", ""),
    "questions_addressed": questions_addressed,      # from Step A
    "questions_missed": questions_missed,             # from Step A
    "recommendation_feedback": summary_data.get(...), # from Step C
    "reasoning_gaps": summary_data.get(...),          # from Step C
    "overall_score": overall_score,                   # from Step B
    "suggested_rewrites": suggested_rewrites,         # from Step D
    "answer_key_comparison": answer_key_comparison,   # from Step E
    "recommendation": recommendation,                 # raw student input
}
```

### Fallback Path (Full Transcript)

Used when no tagged messages exist — either because the embedding matcher wasn't active, the session had no key questions, or matching failed.

This path makes a **single LLM call** with the full transcript, all key questions, the recommendation, and optionally the answer key. The LLM is responsible for everything: identifying which questions were addressed, scoring, generating rewrites, and comparing against the answer key.

The system prompt (`debrief_prompt` from the DB) defines the complete JSON schema the LLM must produce. The LLM is given up to 3 attempts (initial + 2 retries) to produce valid JSON. On retry, the error message from the previous parse failure is included in the prompt.

If all attempts fail, a fallback debrief is constructed with the raw LLM output as the summary and empty arrays for all structured fields.

---

## Debrief Prompt System

**Migration:** `cdk/lambda/db_setup/migrations/009_debrief_prompt.js`

The debrief system prompt is stored per simulation group in the `debrief_prompt` column of the `simulation_groups` table. This allows instructors to customize the evaluation criteria for different courses or scenarios.

Key features:
- **DB-driven, no hardcoded fallback** — `fetch_debrief_prompt()` raises an error if the column is NULL/empty
- **Version history** — The `debrief_prompt_history` table tracks all changes with `modified_by`, `prompt_content`, and `created_at`
- **Default seeded on migration** — Migration 009 seeds all existing rows with the default `DEBRIEF_SYSTEM_PROMPT` text

The default prompt instructs the LLM to:
- Use **semantic matching** (generous interpretation of student phrasing)
- Produce a specific JSON schema with all required fields
- Follow strict JSON output rules (no markdown fences, no preamble, proper escaping)
- Only generate rewrites for moderate-confidence matches (similarity 0.55–0.79)
- Compare against the answer key when provided

---

## Schema Validation and Repair

**Function:** `validate_debrief_output(data, answer_key_provided)`

After the LLM produces its output (via either path), the result goes through validation and repair. This function guarantees the debrief dict has every required key with the correct nested structure.

### What It Validates

| Field | Expected Type | Default |
|-------|--------------|---------|
| `summary` | string | `""` |
| `questions_addressed` | list of dicts | `[]` |
| `questions_missed` | list of dicts | `[]` |
| `recommendation_feedback` | dict with `strengths` and `areas_for_improvement` lists | `{ strengths: [], areas_for_improvement: [] }` |
| `reasoning_gaps` | string | `""` |
| `overall_score` | int/float (rounded to whole number) | `0.0` |
| `suggested_rewrites` | list of dicts | `[]` |
| `answer_key_comparison` | dict (only when answer key was provided) | `{ answer_key_available: false }` |

Each nested entry in `questions_addressed`, `questions_missed`, and `suggested_rewrites` is also validated for required sub-keys.

### Post-Validation Score Recomputation

After validation, the score is **always recomputed deterministically** using `compute_overall_score()` when key questions and addressed questions are available. This prevents the LLM from returning incorrect scores (e.g., 0% when questions were clearly addressed).

---

## Persistence Layer

### `save_debrief_to_db()`

Inserts a row into the `debriefs` table with:
- `chat_id` (session_id)
- `student_id`, `persona_id`, `simulation_group_id`
- `generated_text` — The full debrief JSON as a string
- `missing_key_questions` — JSON array of missed questions
- `reasoning_gaps` — Text string
- `rubric_scores` — JSON of recommendation_feedback
- `total_questions_assigned`, `total_questions_asked`, `total_questions_missed`
- `overall_score`
- `created_at`

### `save_question_interactions()`

Writes one row per key question to the `question_interactions` table for analytics:
- `chat_id`, `question_id`, `student_id`, `persona_id`, `simulation_group_id`
- `was_asked` — Boolean, whether the question was in the addressed list
- `is_correct` — Currently simplified to equal `was_asked`

This enables aggregate analytics like "which questions are most commonly missed across all students."

---

## Real-Time Delivery via AppSync

**Function:** `publish_to_appsync(session_id, data)`

After saving to the database, the debrief is published to AWS AppSync using a GraphQL mutation:

```graphql
mutation PublishTextStream($sessionId: String!, $data: AWSJSON!) {
    publishTextStream(sessionId: $sessionId, data: $data) {
        sessionId
        data
    }
}
```

The payload includes `{ type: "debrief", content: <debrief JSON> }`. Authentication uses a Cognito User Pool token. This allows the frontend to receive the debrief in real-time via a GraphQL subscription, though the frontend also has a polling fallback.

---

## Frontend Retrieval and Polling

**File:** `frontend/src/services/studentService.ts` — `fetchDebrief()`

The frontend uses a dual strategy to retrieve the debrief:

### Polling with Exponential Backoff

When the student's chat page requests the debrief, `fetchDebrief()` polls `GET /student/get_debrief` with exponential backoff:

- **Max attempts:** 6
- **Base delay:** 400ms
- **Backoff:** `400ms × 2^attempt` (400ms, 800ms, 1.6s, 3.2s, 6.4s, 12.8s)

If the backend returns `status: "generating"` (HTTP 202), the frontend waits and retries. If `generated_text` is present, it proceeds to parsing.

### Backend-Side Retry

The `GET /student/get_debrief` Lambda handler also has its own retry loop:

- **Max retries:** 6
- **Base delay:** 300ms
- **Backoff:** `300ms × 2^attempt`

This handles the race condition where the debrief hasn't been written to the DB yet when the student first requests it.

### Ownership Validation

Before returning the debrief, the Lambda validates that the requesting student actually owns the chat session by joining `chats → student_interactions → enrollments → users`.

---

## Frontend JSON Parsing and Repair

**File:** `frontend/src/lib/debrief-parser.ts`

LLM outputs are notoriously unreliable for JSON formatting. The frontend has a robust multi-layer parsing system:

### `deepParseJson(value)`

Recursively unwraps a value that may be a JSON string (possibly multi-encoded) or an object. Handles up to 5 levels of nesting. If direct `JSON.parse` fails, it extracts the outermost `{ ... }` by counting brace depth (respecting string escaping).

### `extractDebriefFromRawJson(raw)`

Handles truncated JSON from the LLM using progressive repair:

1. **Direct parse** — Try `JSON.parse` first
2. **Progressive closing** — Try appending various closing sequences (`"}`, `"]`, `}}`, etc.) up to 8 times
3. **Common truncation patterns** — Try specific repairs like `]}]}` and `"}]}`
4. **Last resort truncation** — Find the last complete key-value pair, count open braces/brackets, and append the correct closing sequence

All repair attempts validate that the result has a `summary` key before accepting it.

### Additional Frontend Repairs in `fetchDebrief()`

After `deepParseJson`, the service function checks if the `summary` field itself contains `{` (indicating the LLM nested the entire JSON inside the summary). If so, it attempts to extract and repair the nested JSON using `extractDebriefFromRawJson()`.

---

## Frontend Rendering (AIDebriefDialog)

**File:** `frontend/src/components/AIDebriefDialog.tsx`

The `AIDebriefDialog` component renders the debrief in a modal dialog with these sections:

### 1. Interview Summary
Displays the `summary` text and the `overallScore` as a color-coded badge:
- **Green (≥70%):** Good performance
- **Yellow (50-69%):** Needs improvement
- **Red (<50%):** Significant gaps

### 2. Key Questions Successfully Addressed
Lists `questionsAddressed` with green checkmark icons.

### 3. Key Questions Missed
Shows the count of `missedKeyQuestionsCount` and optional `missedQuestionsGuidance` text.

### 4. Suggested Question Rewrites
For each rewrite, shows the original message ("Instead of: ...") and the suggested improvement ("Try: ...").

### 5. Recommendations Feedback
Displays `strengths` and `areasForImprovement` as bulleted lists under separate headings.

### 6. Answer Key (conditional)
Only shown when `showAnswerKey` prop is true. Includes:
- A "View Answer Key" button that fetches a pre-signed S3 URL
- The student's recommendation text
- **Answer Key Comparison** with color-coded sections:
  - **Correct Elements** — Green checkmarks
  - **Missing Elements** — Yellow warning icons
  - **Incorrect Elements** — Red X icons
  - **Overall Alignment** — Color-coded badge (Strong/Partial/Weak)

### 7. Debrief Feedback
A feedback widget at the bottom where students can rate the debrief as helpful/not helpful and optionally leave a comment.

---

## Debrief Feedback Collection

**Migration:** `cdk/lambda/db_setup/migrations/012_debrief_feedback.js`

Students can provide feedback on the quality of the AI debrief.

### Frontend Flow
1. Student clicks thumbs up/down in the `AIDebriefDialog`
2. Optionally enters a comment
3. `studentService.submitDebriefFeedback()` sends a POST to `/student/debrief_feedback`

### Backend Handler
**File:** `cdk/lambda/lib/studentFunction.js` — `POST /student/debrief_feedback`

Validates the request body (`simulation_group_id`, `persona_id`, `chat_id`, `is_helpful` required), looks up the user_id from the authenticated email, and inserts into the `debrief_feedback` table.

### Database Table

```sql
CREATE TABLE debrief_feedback (
    feedback_id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    simulation_group_id uuid REFERENCES simulation_groups,
    persona_id uuid REFERENCES personas,
    chat_id uuid REFERENCES chats,
    user_id uuid REFERENCES users,
    is_helpful boolean NOT NULL,
    comment text,
    submitted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## Instructor/Admin Debrief Viewing

**File:** `frontend/src/hooks/useDebriefViewer.ts`

Instructors and admins can view debriefs for any student attempt. The `useDebriefViewer` hook manages:

- **Fetching** — Calls `instructorService.fetchDebrief(attemptId, groupId)` which hits a different API endpoint with instructor-level permissions
- **State management** — Tracks loading states, selected debrief data, and dialog open/close
- **PDF export** — Uses `downloadChatPdf()` to generate a PDF from the debrief dialog DOM, temporarily removing scroll constraints for full capture

---

## Test Debrief (Prompt Playground)

**Function:** `generate_test_debrief()` in `chat.py`

The Prompt Playground feature allows admins to test debrief prompt variations against real session data without persisting results. `generate_test_debrief()` reuses the full debrief pipeline (same multi-step process) but:

- Accepts the `debrief_prompt` as a parameter instead of fetching from DB
- **Skips** `save_debrief_to_db()`
- **Skips** `save_question_interactions()`
- **Skips** `publish_to_appsync()`

This is invoked via `mode=test_debrief` on the text generation Lambda.

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `chats` | Stores `recommendation`, `status`, `ended_at` for concluded sessions |
| `messages` | Stores `matched_question_ids` JSONB for real-time question matching |
| `debriefs` | Stores the full `generated_text` JSON and analytics columns |
| `question_interactions` | Per-question analytics (was_asked, is_correct) |
| `question_bank` | Key questions with text, evaluation_criteria, is_mandatory, weight |
| `simulation_group_questions` | Links questions to simulation groups/personas with weight_override |
| `simulation_groups` | Stores `debrief_prompt` per group |
| `debrief_prompt_history` | Audit trail for prompt changes |
| `debrief_feedback` | Student feedback on debrief quality |
| `user_engagement_log` | Tracks `chat_concluded` events |

### Key Migrations

| Migration | What It Does |
|-----------|-------------|
| `006_conclude_interaction.js` | Adds `started_at`, `ended_at`, `status`, `recommendation` to `chats` |
| `009_debrief_prompt.js` | Adds `debrief_prompt` to `simulation_groups`, creates `debrief_prompt_history` |
| `012_debrief_feedback.js` | Creates `debrief_feedback` and `issue_reports` tables |

---

## Key Files Reference

| File | Role |
|------|------|
| `cdk/text_generation/src/main.py` | Lambda entry point, mode branching |
| `cdk/text_generation/src/helpers/chat.py` | Core debrief logic: generation, matching, scoring, prompts, DB persistence |
| `cdk/lambda/lib/studentFunction.js` | API handlers: conclude_interaction, get_debrief, debrief_feedback |
| `frontend/src/components/AIDebriefDialog.tsx` | Debrief UI rendering |
| `frontend/src/components/ConfirmConcludeDialog.tsx` | Conclude confirmation + recommendation input |
| `frontend/src/services/studentService.ts` | Frontend API client: fetchDebrief, submitDebriefFeedback |
| `frontend/src/lib/debrief-parser.ts` | JSON parsing and repair utilities |
| `frontend/src/hooks/useDebriefViewer.ts` | Instructor/admin debrief viewing hook |
| `cdk/lambda/db_setup/migrations/006_conclude_interaction.js` | DB schema for conclude flow |
| `cdk/lambda/db_setup/migrations/009_debrief_prompt.js` | DB schema for customizable prompts |
| `cdk/lambda/db_setup/migrations/012_debrief_feedback.js` | DB schema for feedback collection |
