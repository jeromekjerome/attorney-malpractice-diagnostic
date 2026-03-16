import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function checkTables() {
    try {
        const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
        console.log("Tables:", tables.map(t => t.table_name));
    } catch (err) {
        console.error(err);
    }
}

checkTables();
