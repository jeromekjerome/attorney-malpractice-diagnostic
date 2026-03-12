import 'dotenv/config'; // Loads variables from .env
import { neon } from '@neondatabase/serverless';

// Pulling the URL from your environment variables
const sql = neon(process.env.DATABASE_URL);

async function testEnvConnection() {
    try {
        console.log("Attempting to connect using .env credentials...");

        // Testing with a small query to verify authentication
        const result = await sql`SELECT blog_post, url FROM bluestone_blog_pages LIMIT 3`;

        console.log("✅ Success! Database connected via .env.");
        console.log("Sample Data:", result);
    } catch (err) {
        console.error("❌ Connection failed using .env:");
        console.error("Error Message:", err.message);

        if (!process.env.DATABASE_URL) {
            console.log("Tip: The variable DATABASE_URL is missing or undefined.");
        }
    }
}

testEnvConnection();