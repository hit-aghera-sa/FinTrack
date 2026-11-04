import js from '@eslint/js';
import globals from 'globals';
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
  { ignores: ['dist/**', 'node_modules/**', 'k6/**'] },
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
  },
);
