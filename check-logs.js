import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

async function check() {
    const sql = neon(process.env.DATABASE_URL);
    try {
        const rows = await sql`
            SELECT id, question, mode, session_id, lead_email_sent, created_at 
            FROM user_interactions 
            ORDER BY created_at DESC 
            LIMIT 10
        `;
        console.log(JSON.stringify(rows, null, 2));
    } catch (err) {
        console.error('Error fetching logs:', err.message);
    }
}

check();
