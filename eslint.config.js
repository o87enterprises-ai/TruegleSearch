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
      // 2022, not 2020. At 2020 the parser rejects NUMERIC SEPARATORS —
      // `30_000`, `1_000_000` — with "Parsing error: Identifier directly
      // after number", which is a lie: that syntax has been standard since
      // ES2021 and Vite compiles it without complaint. Three files failed to
      // parse for that reason alone, so `npm run lint` was permanently red on
      // code that was never wrong, which is exactly how a lint run stops
      // being read. (The .mjs block below was already on 2022.)
      ecmaVersion: 2022,
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
    // never touches a DOM. Without this they are no-undef errors that are all
    // false.
    //
    // Listed by name rather than matched by `verify-*.mjs`, because the other
    // verifiers (map-api, navigation) are pure Node — handing THEM browser
    // globals would hide a real `document` reference instead of catching it.
    files: [
      '**/verify-*-browser.mjs',
      '**/verify-feed-page.mjs',
      '**/verify-feed-playable.mjs',
      '**/verify-osiris-layers.mjs',
      '**/verify-player-engine.mjs',
      '**/verify-camera-view.mjs',
      '**/verify-map-ui.mjs',
      '**/verify-player-reddit.mjs',
      '**/verify-trail-page.mjs',
      '**/verify-chat-map.mjs',
      // These five were launching a browser and calling page.evaluate all
      // along without being listed, so `npm run lint` failed with 12 no-undef
      // errors on files nobody had edited. Added by name, not by widening the
      // glob, so the pure-Node verifiers keep catching a real `document`.
      '**/verify-autocomplete-ui.mjs',
      '**/verify-camera-pins.mjs',
      '**/verify-globe-texture.mjs',
      '**/verify-no-select.mjs',
      '**/verify-osint-gate.mjs',
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    // Jest suites. Same reasoning as the .mjs block above: without this,
    // `describe`/`it`/`expect` are no-undef in every test file — 88 errors
    // across the backend suites that say nothing about the tests and train
    // everyone to scroll past lint output, which is how a real error hides.
    files: ['**/__tests__/**/*.js', '**/*.test.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },
];