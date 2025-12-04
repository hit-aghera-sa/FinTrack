import tsParser from '@typescript-eslint/parser';
import tseslint from '@typescript-eslint/eslint-plugin';
import angularEslint from '@angular-eslint/eslint-plugin';

// ✅ Correct parser + plugin for HTML templates
import angularTemplateParser from '@angular-eslint/template-parser';
import angularTemplatePlugin from '@angular-eslint/eslint-plugin-template';

export default [
  {
    ignores: ['node_modules', 'dist', 'browser', 'server', 'coverage']
  },

  // TS rules
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module'
    },
    plugins: {
      '@angular-eslint': angularEslint,
      '@typescript-eslint': tseslint
    },
    rules: {
      'no-console': 'error',
      eqeqeq: 'error',
      '@typescript-eslint/no-unused-vars': 'warn',

      '@angular-eslint/prefer-inject': 'off',
      '@angular-eslint/no-empty-lifecycle-method': 'off',

      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-inferrable-types': 'off'
    }
  },

  // HTML template linting
  {
    files: ['**/*.html'],
    languageOptions: {
      parser: angularTemplateParser
    },
    plugins: {
      '@angular-eslint/template': angularTemplatePlugin
    },
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'off',
      '@angular-eslint/template/click-events-have-key-events': 'off',
      '@angular-eslint/template/interactive-supports-focus': 'off',
      '@angular-eslint/template/label-has-associated-control': 'off'
    }
  },

  // ✅ Allow console.* ONLY inside logging.service.ts
  {
    files: ['src/app/core/services/logging.service.ts'],
    rules: {
      'no-console': 'off'
    }
  }
];
