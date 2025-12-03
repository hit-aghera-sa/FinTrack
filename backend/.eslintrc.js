module.exports = {
  env: {
    node: true,
    es2021: true
  },

  // Lint recommended rules + disable formatting conflicts
  extends: ['eslint:recommended', 'prettier'],

  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'script' // IMPORTANT — backend is CommonJS, NOT ESM
  },

  ignorePatterns: ['node_modules', 'dist', 'uploads'],

  rules: {
    'no-console': 'error', // block console.log, console.error, etc.
    'no-unused-vars': 'warn', // warn if var is declared but not used
    'prefer-const': 'error', // enforce const where possible
    eqeqeq: 'error' // force === and !==
  }
};
