/**
 * pgvector document retrieval for RAG (Retrieval-Augmented Generation).
 *
 * Ported from the PGVector retriever pattern in cdk/data_ingestion/src/helpers/helper.py.
 * Queries the langchain_pg_embedding table for cosine similarity search
 * against the persona's collection.
 *
 * Uses the same PostgreSQL connection pool from db.js.
 */

const { getPool } = require('./db');

const logger = {
  info: (...args) => console.log(JSON.stringify({ level: 'INFO', message: args.join(' ') })),
  warn: (...args) => console.warn(JSON.stringify({ level: 'WARN', message: args.join(' ') })),
  error: (...args) => console.error(JSON.stringify({ level: 'ERROR', message: args.join(' ') })),
};

/**
 * Retrieve relevant document chunks from pgvector using cosine similarity search.
 *
 * The langchain_pg_embedding table stores document embeddings indexed by collection.
 * Each persona has its own collection (collection_name = persona_id).
 * We join langchain_pg_collection to resolve the collection UUID, then query
 * embeddings ordered by cosine distance to the query embedding vector.
 *
 * @param {string} personaId - The persona ID, used as the collection name
 * @param {string} query - The user's query text (for logging only)
 * @param {number[]} embeddingVector - The embedding vector for the query
 * @param {number} [topK=4] - Number of top results to return
 * @returns {Promise<Array<{pageContent: string, metadata: object}>>}
 */
async function retrieveDocuments(personaId, query, embeddingVector, topK = 4) {
  const db = await getPool();

  try {
    // Format the embedding vector as a pgvector literal: '[0.1,0.2,...]'
    const vectorLiteral = `[${embeddingVector.join(',')}]`;

    // Query the langchain_pg_embedding table joined with langchain_pg_collection
    // to find documents in the persona's collection, ordered by cosine distance.
    const result = await db.query(
      `SELECT e.document, e.cmetadata
       FROM langchain_pg_embedding e
       JOIN langchain_pg_collection c ON e.collection_id = c.uuid
       WHERE c.name = $1
       ORDER BY e.embedding <=> $2::vector
       LIMIT $3`,
      [personaId, vectorLiteral, topK]
    );

    const documents = result.rows.map((row) => ({
      pageContent: row.document || '',
      metadata: row.cmetadata || {},
    }));

    logger.info(`Retrieved ${documents.length} documents for persona=${personaId}, query="${query.substring(0, 60)}..."`);
    return documents;
  } catch (err) {
    logger.error(`Error retrieving documents for persona=${personaId}: ${err.message}`);
    // Fall back to empty context — degraded but functional
    return [];
  }
}

module.exports = {
  retrieveDocuments,
};
