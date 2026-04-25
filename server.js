import { answerUserQuestion, checkViability } from './ask.js';
import { runChunker } from './chunker.js';
import { sendNotificationEmail } from './email.js';
import { neon } from '@neondatabase/serverless';
import OpenAI from 'openai';
import 'dotenv/config';
import { createApp } from './app.js';
import { buildModelList, probeAllModelChains } from './openaiModelFailover.js';

const sql = neon(process.env.DATABASE_URL);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const answerModels = buildModelList(
  process.env.OPENAI_MODEL_ANSWER || 'gpt-4o',
  process.env.OPENAI_MODEL_ANSWER_FALLBACKS || 'gpt-5.4-mini,gpt-4.1'
);
const auxModels = buildModelList(
  process.env.OPENAI_MODEL_AUX || 'gpt-4o-mini',
  process.env.OPENAI_MODEL_AUX_FALLBACKS || 'gpt-5.4-mini,gpt-4.1'
);
const embeddingModels = buildModelList(
  process.env.OPENAI_MODEL_EMBEDDING || 'text-embedding-3-small',
  process.env.OPENAI_MODEL_EMBEDDING_FALLBACKS || 'text-embedding-3-large'
);

let modelHealthSnapshot = {
  answer: { active: answerModels[0] || null, fallbacks_available: answerModels.slice(1) },
  aux: { active: auxModels[0] || null, fallbacks_available: auxModels.slice(1) },
  embedding: { active: embeddingModels[0] || null, fallbacks_available: embeddingModels.slice(1) },
};

const app = createApp({
  answerUserQuestion,
  checkViability,
  runChunker,
  sendNotificationEmail,
  sql,
  openai,
  env: process.env,
});

async function refreshModelHealthSnapshot() {
  modelHealthSnapshot = await probeAllModelChains(openai, {
    answerModels,
    auxModels,
    embeddingModels,
  });
  console.log('[Health] Model callable check:', JSON.stringify(modelHealthSnapshot));
}

app.get('/health/models', (_req, res) => {
  res.json(modelHealthSnapshot);
});

const PORT = process.env.PORT || 3000;

refreshModelHealthSnapshot()
  .catch((err) => console.error('[Health] Startup model probe failed:', err.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`\nServer is running on http://localhost:${PORT}`);
      console.log(`Navigate to http://localhost:${PORT} to view the frontend.\n`);
    });
  });
