import { test, expect } from '@playwright/test';

async function mockTopics(page, topics = ['Statute of Limitations', 'Continuous Representation', 'Privilege Breach']) {
  await page.route('**/api/topics', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ topics }),
    });
  });
}

test('client mode question renders analysis, sources, and follow-up label', async ({ page }) => {
  await mockTopics(page);

  let askPayload;
  await page.route('**/api/ask', async route => {
    askPayload = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        answer: '### Core Issue\nYour lawyer may have missed a filing deadline. What date did the dismissal happen?',
        raw_answer: 'Your lawyer may have missed a filing deadline. What date did the dismissal happen?',
        sources: [
          {
            post_url: 'https://example.com/blog/missed-statute-of-limitations/',
            citations: ['*Smith v. Jones*, 123 A.D.3d 456'],
          },
        ],
      }),
    });
  });

  await page.goto('/');
  await expect(page.locator('#topicsList .topic-item').first()).toHaveText('Statute of Limitations');
  await page.locator('#questionInput').fill('My lawyer missed the deadline to sue.');
  await page.locator('#submitBtn').click();

  await expect(page.locator('#answerText')).toContainText('You:');
  await expect(page.locator('#answerText')).toContainText('Core Issue');
  await expect(page.locator('#sourcesList')).toContainText('Missed Statute Of Limitations');
  await expect(page.locator('#questionLabel')).toContainText('What date did the dismissal happen?');

  expect(askPayload.mode).toBe('client');
  expect(Array.isArray(askPayload.messages)).toBeTruthy();
  expect(askPayload.messages.at(-1).content).toBe('My lawyer missed the deadline to sue.');
  expect(typeof askPayload.sessionId).toBe('string');
  expect(askPayload.sessionId.length).toBeGreaterThan(10);
});

test('professor mode changes the UI and sends professor-mode requests', async ({ page }) => {
  await mockTopics(page, ['Duty', 'Breach', 'Causation']);

  let askPayload;
  await page.route('**/api/ask', async route => {
    askPayload = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        answer: 'Let us begin with duty. What is the first element of a malpractice claim?',
        raw_answer: 'Let us begin with duty. What is the first element of a malpractice claim?',
        sources: [],
      }),
    });
  });

  await page.goto('/');
  await page.locator('.switch').click();

  await expect(page.locator('body')).toHaveClass(/professor-mode/);
  await expect(page.locator('#submitBtn .btn-text')).toHaveText('Submit to Professor');
  await expect(page.locator('#questionLabel')).toContainText('What New York precedent or doctrine shall we examine today?');

  await page.locator('#questionInput').fill('Professor, quiz me on continuous representation.');
  await page.locator('#submitBtn').click();

  await expect(page.locator('#answerText')).toContainText('Let us begin with duty');
  expect(askPayload.mode).toBe('professor');
  expect(askPayload.messages.at(-1).content).toBe('Professor, quiz me on continuous representation.');
});

test('frontend shows a friendly error when the analysis request fails', async ({ page }) => {
  await mockTopics(page);
  await page.route('**/api/ask', async route => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'boom' }),
    });
  });

  await page.goto('/');
  await page.locator('#questionInput').fill('Can I sue my lawyer for a conflict of interest?');
  await page.locator('#submitBtn').click();

  await expect(page.locator('#resultsWrapper')).not.toHaveClass(/hidden/);
  await expect(page.locator('#answerText')).toContainText('An error occurred while analyzing your case. Please try again later.');
});