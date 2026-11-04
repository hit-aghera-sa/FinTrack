import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// Seeded runnable-shell ESLint flat config. Extend the rule set as the app needs.
export default tseslint.config(
  // `k6/**` alongside the build outputs: k6 load scripts are executed by the k6 BINARY, not by Node
  // or a browser, and its runtime injects globals (`__ENV`, `__VU`, `__ITER`) that no `globals`
  // preset declares. With `no-undef` deliberately ON (see the block below), every such reference is
  // reported — MEASURED on the inventory app: `k6/load.js 4:14 error '__ENV' is not defined`. That
  // diagnostic can never name a real defect: the identifier is provided by the runtime the file is
  // written for. Same reasoning as the globals union below — do not make the linter report what it
  // structurally cannot judge. These files are not application source: nothing imports them, and
  // `tsc` never sees them, so ignoring costs no real coverage.
  // B4 (react-native, 2026-09-18) applied to web, 2026-09-23. ENGINE-authored files carry the
  // `.engine.` infix and NO lane can repair them — the harness rewrites them before every gate. Left
  // lintable, their findings reach the coder as defects it cannot fix: `e2e/smoke.engine.spec.js`
  // failed `no-redeclare` on every gate run of every build until the spec itself was corrected, and
  // react-native measured 4 errors + 1 warning from the same class. The app tree stays fully linted;
  // only the engine's own files are exempt, and they are pinned lint-clean in their own right by
  // `engine-spec-lint-invariant.test.ts`.
  { ignores: ['dist/**', 'node_modules/**', 'k6/**', '**/*.engine.*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // C6 — DECLARE THE ENVIRONMENT. ESLint 9 flat config defaults `globals` to {} and
    // `js.configs.recommended` turns on `no-undef`, so without this block `console`, `process`,
    // `setInterval`, `URL`, `document`, `window` and `module` are undefined BY CONSTRUCTION —
    // every real app trips it on line one. Measured on MEASURE-0815 MERN: 30 of 30 lint failures
    // were this, and NOT ONE named a real defect.
    //
    // Both environments deliberately: the seeded shell is full-stack (browser `src/**` beside a node
    // `src/server/**`), and a per-directory split would break the moment a coder moves a file. The
    // cost of the union is that a browser file referencing a node global is not flagged — a far
    // cheaper error than failing every file that logs.
    //
    // Declared, NOT silenced. `no-undef` stays ON, so a genuine typo is still caught; turning the
    // rule off would have hidden real defects along with the false ones.
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.es2021 },
    },
    rules: {
      // DECLARE THE UNDERSCORE CONVENTION — same reasoning as the globals block above, one layer up.
      //
      // `tseslint.configs.recommended` turns on `@typescript-eslint/no-unused-vars` with NO ignore
      // pattern, while every coder in this system writes `_next`, `_req`, `_error` for a parameter
      // it is REQUIRED to accept and deliberately does not use — Express error middleware cannot drop
      // its 4th argument without ceasing to be error middleware. So the seed contradicted the
      // convention its own coder follows.
      //
      // MEASURED on the live SnapNote run (2026-09-11): `src/server/app.ts:146 '_next' is defined but
      // never used` failed the advisory `lint` gate on EVERY lane of EVERY cycle — the same 373-byte
      // output every time. Advisory ⇒ never blocks ⇒ never corrected ⇒ a permanent false red on every
      // gate record, and one more finding an operator must learn to ignore.
      //
      // Declared, NOT silenced: the rule stays ON and still catches a genuinely unused `next`. Only
      // the explicit `_` opt-out — the universal signal for "intentionally unused" — is honoured.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Load react-hooks so its rules exist: an `eslint-disable ... react-hooks/exhaustive-deps` directive for
    // an unregistered rule is itself reported as an error ("Definition for rule ... was not found").
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
  },
  {
    // The rules RUN on client UI code only: every JSX file, and plain modules under the UI directories.
    // They read any call to a function named use*() as a React Hook, so on server code a helper such as
    // `useSecureCookie()` called from a request handler - or a Playwright fixture calling `use(value)` -
    // is reported as a rules-of-hooks error in code that has nothing wrong with it.
    files: ['**/*.tsx', 'src/{design,ui,client,components,screens,pages,hooks}/**/*.ts'],
    rules: reactHooks.configs.recommended.rules,
  },
);
