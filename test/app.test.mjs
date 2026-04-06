import assert from 'node:assert/strict';

import { createApp } from '../app.js';
import { createSqlMock, startServer } from './helpers.mjs';
import { test } from './runner.mjs';

function makeDeps(overrides = {}) {
  const sqlCalls = [];
  const deps = {
    sqlCalls,
    answerCalls: [],
    viabilityCalls: [],
    notificationCalls: [],
    chunkerCalls: 0,
    topicCalls: [],
    sql: createSqlMock(async (strings, values) => {
      const text = strings.join(' ');
      sqlCalls.push({ text, values });

      if (text.includes('SELECT lead_email_sent')) return [];
      if (text.includes('UPDATE user_interactions SET lead_email_sent = TRUE')) return [];
      if (text.includes('ORDER BY created_at DESC')) return [];
      return [];
    }),
    answerUserQuestion: async (messages, mode) => {
      deps.answerCalls.push({ messages, mode });
      return { answer: 'ok', raw_answer: 'analysis text' };
    },
    checkViability: async (history, analysis) => {
      deps.viabilityCalls.push({ history, analysis });
      return false;
    },
    runChunker: async () => {
      deps.chunkerCalls += 1;
    },
    sendNotificationEmail: async payload => {
      deps.notificationCalls.push(payload);
    },
    openai: {
      chat: {
        completions: {
          create: async payload => {
            deps.topicCalls.push(payload);
            return {
              choices: [
                { message: { content: JSON.stringify({ topics: ['Topic A', 'Topic B', 'Topic C', 'Topic D', 'Topic E'] }) } },
              ],
            };
          },
        },
      },
    },
    env: { CRON_SECRET: 'secret' },
    now: () => 1700000000000,
  };

  Object.assign(deps, overrides);
  return deps;
}

test('cron rejects invalid secrets', async () => {
  const deps = makeDeps();
  const app = createApp(deps);
  const server = await startServer(app);

  try {
    const response = await fetch(`${server.baseUrl}/api/cron`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.deepEqual(body, { error: 'Unauthorized' });
    assert.equal(deps.chunkerCalls, 0);
  } finally {
    await server.close();
  }
});

test('cron runs the chunker when authorized', async () => {
  const deps = makeDeps();
  const app = createApp(deps);
  const server = await startServer(app);

  try {
    const response = await fetch(`${server.baseUrl}/api/cron`, {
      headers: { authorization: 'Bearer secret' },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true });
    assert.equal(deps.chunkerCalls, 1);
  } finally {
    await server.close();
  }
});

test('ask rejects empty requests', async () => {
  const deps = makeDeps();
  const app = createApp(deps);
  const server = await startServer(app);

  try {
    const response = await fetch(`${server.baseUrl}/api/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(body, { error: 'A question or message history is required.' });
  } finally {
    await server.close();
  }
});

test('ask uses fallback session ids, logs interaction, and skips lead email when not viable', async () => {
  const deps = makeDeps();
  const app = createApp(deps);
  const server = await startServer(app);

  try {
    const response = await fetch(`${server.baseUrl}/api/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'Did my lawyer miss a deadline?' }),
    });
    const body = await response.json();
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.equal(response.status, 200);
    assert.deepEqual(body, { answer: 'ok', raw_answer: 'analysis text' });
    assert.deepEqual(deps.answerCalls, [{
      messages: [{ role: 'user', content: 'Did my lawyer miss a deadline?' }],
      mode: 'client',
    }]);
    assert.deepEqual(deps.viabilityCalls, [{
      history: [{ role: 'user', content: 'Did my lawyer miss a deadline?' }],
      analysis: 'analysis text',
    }]);
    assert.equal(deps.notificationCalls.length, 0);
    assert.equal(deps.sqlCalls.length, 2);
    assert.match(deps.sqlCalls[0].text, /INSERT INTO user_interactions/);
    assert.deepEqual(deps.sqlCalls[0].values, ['Did my lawyer miss a deadline?', 'client', 'fallback-1700000000000']);
    assert.match(deps.sqlCalls[1].text, /SELECT lead_email_sent/);
  } finally {
    await server.close();
  }
});

test('ask sends one lead email for viable client sessions', async () => {
  const deps = makeDeps();
  deps.checkViability = async (history, analysis) => {
    deps.viabilityCalls.push({ history, analysis });
    return true;
  };
  const app = createApp(deps);
  const server = await startServer(app);

  try {
    const response = await fetch(`${server.baseUrl}/api/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess-1',
        messages: [
          { role: 'user', content: 'My lawyer settled without consent.' },
          { role: 'assistant', content: 'When did that happen?' },
          { role: 'user', content: 'Last month.' },
        ],
      }),
    });
    await response.json();
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.equal(deps.notificationCalls.length, 1);
    assert.deepEqual(deps.notificationCalls[0], {
      question: 'Last month.',
      analysis: 'analysis text',
      history: [
        { role: 'user', content: 'My lawyer settled without consent.' },
        { role: 'assistant', content: 'When did that happen?' },
        { role: 'user', content: 'Last month.' },
      ],
    });
    assert.equal(deps.sqlCalls.length, 3);
    assert.match(deps.sqlCalls[2].text, /UPDATE user_interactions SET lead_email_sent = TRUE/);
    assert.deepEqual(deps.sqlCalls[2].values, ['sess-1']);
  } finally {
    await server.close();
  }
});

test('ask does not run viability checks in professor mode', async () => {
  const deps = makeDeps();
  const app = createApp(deps);
  const server = await startServer(app);

  try {
    const response = await fetch(`${server.baseUrl}/api/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'professor',
        question: 'Quiz me on proximate cause.',
      }),
    });
    await response.json();
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.equal(deps.viabilityCalls.length, 0);
    assert.equal(deps.notificationCalls.length, 0);
    assert.equal(deps.sqlCalls.length, 1);
  } finally {
    await server.close();
  }
});

test('topics returns defaults when there is not enough history', async () => {
  const deps = makeDeps();
  const app = createApp(deps);
  const server = await startServer(app);

  try {
    const response = await fetch(`${server.baseUrl}/api/topics`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.topics.length, 5);
    assert.equal(deps.topicCalls.length, 0);
  } finally {
    await server.close();
  }
});

test('topics synthesizes and caches results', async () => {
  let currentTime = 1700000000000;
  const deps = makeDeps();
  deps.now = () => currentTime;
  deps.sql = createSqlMock(async (strings, values) => {
    const text = strings.join(' ');
    deps.sqlCalls.push({ text, values });
    if (text.includes('ORDER BY created_at DESC')) {
      return [
        { question: 'Can I sue my attorney for missing discovery?' },
        { question: 'What is the statute of limitations for malpractice?' },
        { question: 'Does continuous representation toll the deadline?' },
      ];
    }
    return [];
  });
  const app = createApp(deps);
  const server = await startServer(app);

  try {
    const firstResponse = await fetch(`${server.baseUrl}/api/topics`);
    const firstBody = await firstResponse.json();

    currentTime += 5 * 60 * 1000;

    const secondResponse = await fetch(`${server.baseUrl}/api/topics`);
    const secondBody = await secondResponse.json();

    assert.equal(firstResponse.status, 200);
    assert.deepEqual(firstBody, secondBody);
    assert.equal(deps.topicCalls.length, 1);
    assert.equal(deps.sqlCalls.length, 1);
    assert.match(deps.topicCalls[0].messages[0].content, /continuous representation toll/i);
  } finally {
    await server.close();
  }
});

test('topics returns a 500 when synthesis fails', async () => {
  const deps = makeDeps();
  deps.sql = createSqlMock(async (strings, values) => {
    const text = strings.join(' ');
    deps.sqlCalls.push({ text, values });
    if (text.includes('ORDER BY created_at DESC')) {
      return [
        { question: 'Can I sue my attorney for missing discovery?' },
        { question: 'What is the statute of limitations for malpractice?' },
        { question: 'Does continuous representation toll the deadline?' },
      ];
    }
    return [];
  });
  deps.openai = {
    chat: {
      completions: {
        create: async () => {
          throw new Error('OpenAI unavailable');
        },
      },
    },
  };
  const app = createApp(deps);
  const server = await startServer(app);

  try {
    const response = await fetch(`${server.baseUrl}/api/topics`);
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.deepEqual(body, { error: 'Failed to synthesize topics.' });
  } finally {
    await server.close();
  }
});

test('health returns service status', async () => {
  const deps = makeDeps();
  const app = createApp(deps);
  const server = await startServer(app);

  try {
    const response = await fetch(`${server.baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { status: 'ok', service: 'malpractice-ai' });
  } finally {
    await server.close();
  }
});
