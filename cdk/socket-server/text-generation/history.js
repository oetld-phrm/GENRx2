/**
 * DynamoDB chat history for Bedrock Converse API.
 *
 * Reads and writes conversation history from the DynamoDB-Conversation-Table,
 * formatting messages as role/content pairs for the Bedrock Converse API.
 *
 * The DynamoDB table uses the same schema as LangChain's DynamoDBChatMessageHistory:
 *   - Partition key: SessionId (string)
 *   - History attribute: List of message objects with { data: { type, content } }
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const logger = {
  info: (...args) => console.log(JSON.stringify({ level: 'INFO', message: args.join(' ') })),
  warn: (...args) => console.warn(JSON.stringify({ level: 'WARN', message: args.join(' ') })),
  error: (...args) => console.error(JSON.stringify({ level: 'ERROR', message: args.join(' ') })),
};

let docClient = null;

/**
 * Get or create the DynamoDB Document Client.
 * @returns {DynamoDBDocumentClient}
 */
function getDocClient() {
  if (docClient) return docClient;
  const client = new DynamoDBClient({});
  docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
  return docClient;
}

/**
 * Read conversation history from DynamoDB and format for Bedrock Converse API.
 *
 * The DynamoDB table stores messages in LangChain format:
 *   History: [ { data: { type: "human"|"ai", content: "..." } }, ... ]
 *
 * This function converts them to Bedrock Converse API format:
 *   [ { role: "user"|"assistant", content: [{ text: "..." }] }, ... ]
 *
 * @param {string} sessionId - The chat session ID
 * @param {string} tableName - The DynamoDB table name
 * @returns {Promise<Array<{role: string, content: Array<{text: string}>}>>}
 */
async function getChatHistory(sessionId, tableName) {
  const ddb = getDocClient();

  try {
    const response = await ddb.send(new GetCommand({
      TableName: tableName,
      Key: { SessionId: sessionId },
    }));

    const item = response.Item;
    if (!item || !item.History) {
      logger.info(`No chat history found for session=${sessionId}`);
      return [];
    }

    const history = item.History;
    const messages = [];

    for (const entry of history) {
      const data = entry.data || entry;
      const type = data.type;
      const content = data.content;

      if (!content) continue;

      if (type === 'human') {
        messages.push({
          role: 'user',
          content: [{ text: content }],
        });
      } else if (type === 'ai') {
        messages.push({
          role: 'assistant',
          content: [{ text: content }],
        });
      }
    }

    logger.info(`Retrieved ${messages.length} messages from DynamoDB for session=${sessionId}`);
    return messages;
  } catch (err) {
    logger.warn(`Failed to read chat history from DynamoDB for session=${sessionId}: ${err.message}`);
    return [];
  }
}

/**
 * Append a new student/AI exchange to the DynamoDB conversation history.
 *
 * Stores messages in LangChain-compatible format so the Python Lambda
 * (which still handles match, test_debrief, test_system_prompt modes)
 * can read the same history.
 *
 * @param {string} sessionId - The chat session ID
 * @param {string} studentMessage - The student's message text
 * @param {string} aiMessage - The AI's response text
 * @param {string} tableName - The DynamoDB table name
 */
async function updateDynamoHistory(sessionId, studentMessage, aiMessage, tableName) {
  const ddb = getDocClient();

  const newEntries = [
    {
      data: {
        type: 'human',
        content: studentMessage,
      },
    },
    {
      data: {
        type: 'ai',
        content: aiMessage,
      },
    },
  ];

  try {
    // Try to append to existing history using UpdateCommand
    await ddb.send(new UpdateCommand({
      TableName: tableName,
      Key: { SessionId: sessionId },
      UpdateExpression: 'SET History = list_append(if_not_exists(History, :empty), :entries)',
      ExpressionAttributeValues: {
        ':entries': newEntries,
        ':empty': [],
      },
    }));

    logger.info(`Updated DynamoDB history for session=${sessionId} (+2 messages)`);
  } catch (err) {
    logger.error(`Failed to update DynamoDB history for session=${sessionId}: ${err.message}`);
  }
}

module.exports = {
  getChatHistory,
  updateDynamoHistory,
};
