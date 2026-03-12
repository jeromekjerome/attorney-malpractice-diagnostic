import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import OpenAI from 'openai';

// 1. Initialize connections using your verified .env variables
const sql = neon(process.env.DATABASE_URL);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function runBackfill() {
    let remaining = 1;

    while (remaining > 0) {
        try {
            // 2. Check how many of the 5,062 posts still need vectors
            const countResult = await sql`SELECT count(*) FROM bluestone_blog_pages WHERE embedding IS NULL`;
            remaining = parseInt(countResult[0].count);

            if (remaining === 0) {
                console.log("Success: All 5,062 posts are now vectorized.");
                break;
            }

            console.log(`${remaining} posts remaining. Processing next batch of 50...`);

            // 3. Fetch the next batch of text
            const posts = await sql`SELECT url, blog_post FROM bluestone_blog_pages WHERE embedding IS NULL LIMIT 50`;

            for (const post of posts) {
                // Generate the 1536-dimension vector
                const response = await openai.embeddings.create({
                    model: "text-embedding-3-small",
                    input: post.blog_post.substring(0, 8000), // Clean text safety limit
                });

                const vector = response.data[0].embedding;

                // 4. Update the row. JSON.stringify ensures the array is 
                // formatted correctly for the Neon VECTOR type
                await sql`
                    UPDATE bluestone_blog_pages 
                    SET embedding = ${JSON.stringify(vector)} 
                    WHERE url = ${post.url}
                `;

                console.log(`Successfully vectorized: ${post.url}`);
            }
        } catch (err) {
            // 5. Handle rate limits or connection blips by waiting 5 seconds
            console.error("Batch failed, retrying in 5 seconds...", err.message);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

runBackfill();