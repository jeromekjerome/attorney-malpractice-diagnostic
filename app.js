import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { buildModelList, chatCompletionsWithFallback } from './openaiModelFailover.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp({
  answerUserQuestion,
  checkViability,
  runChunker,
  sendNotificationEmail,
  sql,
  openai,
  env = process.env,
  now = () => Date.now(),
} = {}) {
  if (!answerUserQuestion) throw new Error('answerUserQuestion dependency is required');
  if (!checkViability) throw new Error('checkViability dependency is required');
  if (!runChunker) throw new Error('runChunker dependency is required');
  if (!sendNotificationEmail) throw new Error('sendNotificationEmail dependency is required');
  if (!sql) throw new Error('sql dependency is required');
  if (!openai) throw new Error('openai dependency is required');

  const app = express();
  let cachedTopics = null;
  let lastTopicUpdate = 0;
  const topicModels = buildModelList(
    env.OPENAI_MODEL_AUX || 'gpt-4o-mini',
    env.OPENAI_MODEL_AUX_FALLBACKS || 'gpt-5.4-mini,gpt-4.1'
  );

  app.use(cors());
  app.use(express.json());
  app.use(express.static(join(__dirname, 'public')));

  app.get('/api/cron', async (req, res) => {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      console.log('[Cron] Nightly ingestion triggered.');
      await runChunker();
      res.json({ ok: true });
    } catch (err) {
      console.error('[Cron] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/ask', async (req, res) => {
    try {
      let { question, messages, mode = 'client', sessionId } = req.body;
      if (!sessionId) sessionId = `fallback-${now()}`;

      if (!question && (!messages || messages.length === 0)) {
        return res.status(400).json({ error: 'A question or message history is required.' });
      }

      const input = messages || [{ role: 'user', content: question }];
      const latestQuestion = input[input.length - 1].content;

      console.log(`[Interaction] ID: ${sessionId} | Mode: ${mode} | Q: ${latestQuestion.substring(0, 50)}...`);
      sql`INSERT INTO user_interactions (question, mode, session_id) VALUES (${latestQuestion}, ${mode}, ${sessionId})`.catch(err => {
        console.error('Failed to log interaction:', err.message);
      });

      const result = await answerUserQuestion(input, mode);

      if (mode === 'client') {
        (async () => {
          const existing = await sql`SELECT lead_email_sent FROM user_interactions WHERE session_id = ${sessionId} AND lead_email_sent = TRUE LIMIT 1`;

          if (existing.length === 0) {
            const shouldNotify = await checkViability(input, result.raw_answer);
            if (shouldNotify) {
              await sendNotificationEmail({
                question: latestQuestion,
                analysis: result.raw_answer,
                history: input,
              });
              await sql`UPDATE user_interactions SET lead_email_sent = TRUE WHERE session_id = ${sessionId}`;
            }
          }
        })().catch(err => console.error('Lead qualification error:', err.message));
      }

      res.json(result);
    } catch (error) {
      console.error('Error processing question:', error);
      res.status(500).json({ error: 'An error occurred while generating the diagnostic.' });
    }
  });

  app.get('/api/topics', async (_req, res) => {
    try {
      if (cachedTopics && (now() - lastTopicUpdate < 15 * 60 * 1000)) {
        return res.json({ topics: cachedTopics });
      }

      const logs = await sql`
        SELECT question
        FROM user_interactions
        WHERE mode = 'client'
        AND length(question) > 20
        ORDER BY created_at DESC
        LIMIT 40
      `;

      if (logs.length < 3) {
        return res.json({
          topics: [
            'Statute of Limitations in NY',
            'Continuous Representation Doctrine',
            "The 'Case Within a Case' Requirement",
            'Settlement Without Consent',
            'Attorney-Client Privilege Breaches',
          ],
        });
      }

      const synthesisPrompt = `You are a legal data analyst. Review these recent user queries from a legal malpractice AI:
${logs.map(l => `- ${l.question}`).join('\n')}

Based on these, generate 5 concise "Common Study Topics" (4-7 words each) that represent the most frequent or interesting legal issues these users are facing. 
Avoid conversational snippets like "yes" or "just last week".
Return ONLY a JSON object: {"topics": ["Topic 1", "Topic 2", ...]} `;

      const response = await chatCompletionsWithFallback(openai, {
        models: topicModels,
        messages: [{ role: 'user', content: synthesisPrompt }],
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content);
      cachedTopics = result.topics;
      lastTopicUpdate = now();

      res.json({ topics: cachedTopics });
    } catch (error) {
      console.error('Error synthesizing topics:', error);
      res.status(500).json({ error: 'Failed to synthesize topics.' });
    }
  });

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'malpractice-ai' }));

  return app;
}
