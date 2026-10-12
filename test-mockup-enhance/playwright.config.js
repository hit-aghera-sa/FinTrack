import { defineConfig } from '@playwright/test';

// ENGINE-OWNED acceptance harness (QAV-01) — regenerated before every web acceptance gate; do not edit.
// Hand edits are overwritten. The project's own specs still run; they are supporting evidence, and the
// engine spec below is what decides the verdict.
const PORT = Number(process.env.PORT) || 4321;

export default defineConfig({
  testDir: './e2e',
  // E2 — ONE sign-in before any spec, as the seeded admin, saved to .qa/auth/state.json. A spec opts
  // in with test.use({ storageState: '.qa/auth/state.json' }); every other spec runs signed out, as before.
  // This config is replaced before every run: a globalSetup, projects or storageState written
  // into it by hand never runs.
  globalSetup: './e2e/sign-in.engine.js',
  // Files run in the order of their paths, whatever the order of these patterns: the project's own
  // specs under e2e/features first, then the engine's exams (e2e/required-routes.engine.spec.js, then
  // e2e/smoke.engine.spec.js).
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
    // The app server's own output, prefixed [WebServer] in the suite log (ENGINE_BOOT_PROBE_DIAGNOSIS).
    stdout: 'pipe',
    stderr: 'pipe',
    // Never adopt a server already on the port: a leaked preview from another project would be graded
    // as if it were this app, and every finding would be garbage.
    reuseExistingServer: false,
  },
});
