import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import OpenAI from 'openai';

const sql = neon(process.env.DATABASE_URL);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Part 1: The Retrieval Logic (Finds the best chunks)
async function getLegalContext(userQuery) {
    const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: userQuery,
    });
    const queryVector = embeddingResponse.data[0].embedding;

    const results = await sql`
        SELECT post_url, chunk_content, 
        1 - (embedding <=> ${JSON.stringify(queryVector)}) AS similarity
        FROM bluestone_blog_chunks
        ORDER BY similarity DESC
        LIMIT 5;
    `;
    return results;
}

// Part 2: The Answer Logic (Generates the response)
export async function answerUserQuestion(question) {
    console.log(`\n🔍 Searching Andrew Bluestone's blog for: "${question}"...`);

    const contextChunks = await getLegalContext(question);

    const contextText = contextChunks
        .map(c => `Source: ${c.post_url}\nContent: ${c.chunk_content}`)
        .join("\n\n---\n\n");

    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: "You are a legal malpractice diagnostic assistant. Use the provided blog excerpts from Andrew Bluestone to answer the user's question. If the answer isn't in the context, say you don't know. Always cite the Source URL."
            },
            {
                role: "user",
                content: `CONTEXT:\n${contextText}\n\nUSER QUESTION: ${question}`
            }
        ]
    });

    console.log("\n--- ATTORNEY MALPRACTICE DIAGNOSTIC ---");
    console.log(response.choices[0].message.content);

    return {
        answer: response.choices[0].message.content,
        sources: contextChunks
    };
}

// Part 3: Test Run (Commented out for export)
// answerUserQuestion("What happens if my lawyer misses the statute of limitations in New York?");