import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { answerUserQuestion } from './ask.js';
import { runChunker } from './chunker.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve frontend files

// ---------------------------------------------------------------------------
// Scheduled Ingestion — runs nightly at 2:00 AM to pick up new blog posts
// The chunker is idempotent: it only processes posts not yet in the chunks table
// ---------------------------------------------------------------------------
cron.schedule('0 2 * * *', () => {
    console.log('[Cron] 🕑 Nightly ingestion job triggered.');
    runChunker();
}, {
    timezone: 'America/New_York'
});

// Run once on startup to catch any posts added while the server was offline
console.log('[Startup] Checking for any un-chunked posts...');
runChunker();

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------
app.post('/api/ask', async (req, res) => {
    try {
        const { question, messages, mode } = req.body;

        if (!question && (!messages || messages.length === 0)) {
            return res.status(400).json({ error: 'A question or message history is required.' });
        }

        const input = messages || [{ role: 'user', content: question }];
        const result = await answerUserQuestion(input, mode);
        res.json(result);
    } catch (error) {
        console.error('Error processing question:', error);
        res.status(500).json({ error: 'An error occurred while generating the diagnostic.' });
    }
});

app.listen(PORT, () => {
    console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
    console.log(`Navigate to http://localhost:${PORT} to view the frontend.\n`);
});
