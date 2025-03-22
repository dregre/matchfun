// eslint.config.js
import js from '@eslint/js'
import jestPlugin from 'eslint-plugin-jest'

export default [
  // Base ESLint recommended config from @eslint/js
  js.configs.recommended,

  // General config for all JS files
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      'no-unused-vars': 'error',
      'no-unreachable': 'error',
      'semi': ['warn', 'never'],
      'quotes': ['warn', 'single']
    }
  },

  // Jest-specific config for test files
  {
    files: [
      '**/__tests__/**/*.{js,jsx}',
      '**/*.{test,spec}.js'
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      // Define Jest globals to avoid "undefined" errors
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly'
      }
    },
    plugins: {
      jest: jestPlugin
    },
    // Apply Jest recommended rules
    rules: {
      ...jestPlugin.configs.recommended.rules
    }
  }
]
