import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout sur le build démo (aucun serveur d'API nécessaire : les données sont
 * simulées dans le navigateur). Trois moteurs : Chromium, Firefox et WebKit (Safari), plus un
 * téléphone. En local : npm run e2e (après npm run build:demo).
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4300/9rayti/',
    locale: 'fr-FR',
    timezoneId: 'Africa/Tunis',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node e2e/serve.mjs dist/frontend/browser 4300',
    url: 'http://localhost:4300/9rayti/',
    reuseExistingServer: !process.env['CI'],
  },
});
