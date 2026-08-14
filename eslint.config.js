import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['**/dist/**', '**/dist', '**/*.debug.jsx', '**/*.original.jsx', '**/*.backup.jsx', '**/dev/.build/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
        React: true,
        JSX: true
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        },
        sourceType: 'module'
      }
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'no-undef': 'error', 
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',
      'react-refresh/only-export-components': 'off',
      'no-unused-vars': 'off',
      'no-case-declarations': 'off'
    },
  },
  {
    // The .mjs verifiers and build scripts are Node programs, not browser code.
    // The block above only matches .js/.jsx, so these were being linted with no
    // globals at all and every `console` / `process` read as undefined — eight
    // errors that said nothing about the scripts and trained everyone to ignore
    // the lint output.
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: { 'no-unused-vars': 'off' },
  },
  {
    // Playwright verifiers are Node programs that also SHIP code into a page:
    // everything inside a `page.evaluate` callback runs in the browser, so
    // `window` and `document` are legitimate there even though the file itself
    // never touches a DOM. Without this they are six no-undef errors that are
    // all false.
    files: ['**/verify-*-browser.mjs'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
];