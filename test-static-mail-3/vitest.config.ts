import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Unit-test runner configuration.
 *
 * ONLY the co-located unit tests under `src/` are run. The Playwright suite under
 * `e2e/` uses an incompatible runner, so it is excluded explicitly — otherwise
 * Vitest would load a `test.describe()` from a Playwright spec and crash the whole
 * `test:unit` gate.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**', 'e2e/**', '**/*.spec.ts', 'playwright.config.ts'],
  },
});
