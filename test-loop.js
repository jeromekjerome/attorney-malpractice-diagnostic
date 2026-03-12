import { neon } from '@neondatabase/serverless';
import OpenAI from 'openai';

import 'dotenv/config'; // Added to support process.env

// 1. Using the connection string from your working environment
const sql = neon(process.env.DATABASE_URL);

// 2. Using your OpenAI key directly to verify access
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function runTestLoop() {
    try {
        console.log("--- Phase 1: Testing Neon Connection ---");
        // Pulling only 50 blog posts as requested
        const posts = await sql`SELECT blog_post, url FROM bluestone_blog_pages LIMIT 50`;
        console.log(`✅ Success: Pulled ${posts.length} posts from Neon.`);

        if (posts.length > 0) {
            console.log("\n--- Phase 2: Testing OpenAI Embedding ---");
            console.log(`Sending first post to OpenAI: ${posts[0].url}`);

            const response = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: posts[0].blog_post.substring(0, 1000), // Testing with 1000 chars
            });

            if (response.data[0].embedding.length === 1536) {
                console.log("✅ Success: OpenAI returned a valid 1536-dimension vector.");
            }
        }
    } catch (err) {
        console.error("\n❌ Test Failed!");
        console.error("Error Message:", err.message);
    }
}

runTestLoop();