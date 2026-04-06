import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: true,
  },
  webServer: {
    command: 'node server.js',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    env: {
      PORT: '4173',
      OPENAI_API_KEY: 'test-openai-key',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/testdb',
      NODE_ENV: 'development',
    },
  },
});