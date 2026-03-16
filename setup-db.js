import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function setupInteractionsTable() {
    try {
        console.log("Setting up user_interactions table...");
        await sql`
            CREATE TABLE IF NOT EXISTS user_interactions (
                id SERIAL PRIMARY KEY,
                question TEXT NOT NULL,
                mode TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        console.log("✅ Success: user_interactions table is ready.");
    } catch (err) {
        console.error("❌ Setup failed:", err.message);
    }
}

setupInteractionsTable();
