import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 30_000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173/pro-runner/', serviceWorkers: 'block', trace: 'retain-on-failure' },
  webServer: { command: 'npx serve . -l 4173', url: 'http://127.0.0.1:4173/pro-runner/', reuseExistingServer: true },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
