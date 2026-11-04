import { defineConfig } from '@playwright/test';

// ENGINE-OWNED acceptance harness (QAV-01) — regenerated before every web acceptance gate; do not edit.
// Hand edits are overwritten. The project's own specs still run; they are supporting evidence, and the
// engine spec below is what decides the verdict.
const PORT = Number(process.env.PORT) || 4173;

export default defineConfig({
  testDir: './e2e',
  // Engine exam first (reporter order follows file order), then the project's own specs.
  testMatch: [/smoke\.engine\.spec\.js$/, /e2e\/.*\.spec\.[cm]?[jt]sx?$/],
  timeout: 120000,
  expect: { timeout: 30000 },
  fullyParallel: false,
  workers: 1,
  // 'list' names every test individually, which is what makes per-test attribution possible at all —
  // a roll-up reporter is why a failed suite could only ever say "the suite did not pass".
  reporter: [['list']],
  use: {
    headless: true,
    baseURL: `http://127.0.0.1:${PORT}`,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run build:app && npm start`,
    url: `http://127.0.0.1:${PORT}`,
    timeout: 180000,
    // Tell the app which port this config is waiting on. A server that reads `process.env.PORT` —
    // which the seeded full-stack entry does — then binds exactly PORT, instead of the capture's
    // ephemeral value while Playwright waits somewhere else. HOST matches the address waited on, as
    // the engine's own boot sets it (WP1 1f): an inherited HOST must not move the app elsewhere.
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
    // Never adopt a server already on the port: a leaked preview from another project would be graded
    // as if it were this app, and every finding would be garbage.
    reuseExistingServer: false,
  },
});
