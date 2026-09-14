import js from '@eslint/js';
import globals from 'globals';

/** `npm run lint` — ESLint 9 flat config for the API (Node ESM). */
export default [
  { ignores: ['node_modules/', 'uploads/', 'coverage/'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // A leading underscore marks a binding that is unused on purpose: Express's
      // `(_req, res)`, or `{ id: _id, ...rest }` to drop a field from a copy.
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', ignoreRestSiblings: true,
      }],
    },
  },
];
