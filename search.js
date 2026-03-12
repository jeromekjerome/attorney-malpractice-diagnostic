import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import OpenAI from 'openai';

const sql = neon(process.env.DATABASE_URL);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Searches the chunked blog posts for the most relevant legal context.
 * @param {string} userQuery - The user's malpractice scenario.
 */
export async function getLegalContext(userQuery) {
    try {
        // 1. Vectorize the user's question
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: userQuery,
        });
        const queryVector = embeddingResponse.data[0].embedding;

        // 2. Perform the Vector Search in Neon
        // We use 1 - (vector <=> vector) to convert distance to a "Similarity Score"
        const results = await sql`
            SELECT 
                post_url, 
                chunk_content, 
                1 - (embedding <=> ${JSON.stringify(queryVector)}) AS similarity
            FROM bluestone_blog_chunks
            ORDER BY similarity DESC
            LIMIT 5;
        `;

        return results;
    } catch (err) {
        console.error("Search failed:", err.message);
        return [];
    }
}