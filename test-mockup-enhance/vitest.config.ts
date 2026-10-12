/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * The UNIT gate's scope.
 *
 * Only the co-located `src/**\/*.test.ts(x)` files run here. The Playwright suite under `e2e/`
 * uses an incompatible runner, so it is excluded: a single `e2e/**\/*.spec.ts` file picked up by
 * Vitest crashes `test:unit` for the whole workspace.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['e2e/**', '**/*.spec.ts', '**/*.spec.js', '**/node_modules/**', 'dist/**'],
    clearMocks: true,
    restoreMocks: true,
  },
});
