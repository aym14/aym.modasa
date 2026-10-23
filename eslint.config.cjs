'use strict';

const backendFiles = ['server.js', 'eslint.config.cjs', 'scripts/**/*.cjs', 'test/**/*.cjs'];
const nodeGlobals = {
  AbortController: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  exports: 'writable',
  fetch: 'readonly',
  module: 'writable',
  process: 'readonly',
  require: 'readonly',
  setTimeout: 'readonly',
  URL: 'readonly'
};

module.exports = [
  {
    ignores: ['node_modules/**', 'data/**', 'coverage/**']
  },
  {
    files: backendFiles,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: nodeGlobals
    },
    rules: {
      'curly': ['error', 'all'],
      'eqeqeq': ['error', 'always'],
      'no-constant-condition': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-eval': 'error',
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'valid-typeof': 'error'
    }
  }
];
