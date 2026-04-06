import { answerUserQuestion, checkViability } from './ask.js';
import { runChunker } from './chunker.js';
import { sendNotificationEmail } from './email.js';
import { neon } from '@neondatabase/serverless';
import OpenAI from 'openai';
import 'dotenv/config';
import { createApp } from './app.js';

const sql = neon(process.env.DATABASE_URL);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = createApp({
  answerUserQuestion,
  checkViability,
  runChunker,
  sendNotificationEmail,
  sql,
  openai,
  env: process.env,
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\nServer is running on http://localhost:${PORT}`);
  console.log(`Navigate to http://localhost:${PORT} to view the frontend.\n`);
});
