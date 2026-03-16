import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function checkColumns() {
    try {
        const columns = await sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'user_interactions'
        `;
        console.log(JSON.stringify(columns, null, 2));
    } catch (err) {
        console.error(err);
    }
}

checkColumns();
