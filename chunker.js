import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import OpenAI from 'openai';

const sql = neon(process.env.DATABASE_URL);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configuration
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 150;

async function runChunker() {
    try {
        // 1. Get posts from the main table that aren't in the chunks table yet
        const posts = await sql`
            SELECT url, blog_post 
            FROM bluestone_blog_pages 
            WHERE url NOT IN (SELECT DISTINCT post_url FROM bluestone_blog_chunks)
            LIMIT 20`; // Small batches for safety

        if (posts.length === 0) {
            console.log("✅ All posts have been chunked!");
            return;
        }

        for (const post of posts) {
            console.log(`Processing: ${post.url}`);
            const text = post.blog_post;
            const chunks = [];

            // 2. Simple Sliding Window Chunking logic
            for (let i = 0; i < text.length; i += (CHUNK_SIZE - CHUNK_OVERLAP)) {
                chunks.push(text.substring(i, i + CHUNK_SIZE));
                if (i + CHUNK_SIZE >= text.length) break;
            }

            for (const chunkText of chunks) {
                // 3. Generate embedding for each specific chunk
                const response = await openai.embeddings.create({
                    model: "text-embedding-3-small",
                    input: chunkText,
                });

                const vector = response.data[0].embedding;

                // 4. Insert into the chunks table
                await sql`
                    INSERT INTO bluestone_blog_chunks (post_url, chunk_content, embedding)
                    VALUES (${post.url}, ${chunkText}, ${JSON.stringify(vector)})
                `;
            }
            console.log(`Successfully created ${chunks.length} chunks for: ${post.url}`);
        }

        // Auto-recurse to next batch
        runChunker();

    } catch (err) {
        console.error("Chunking error:", err.message);
        setTimeout(runChunker, 5000); // Retry on failure
    }
}

runChunker();