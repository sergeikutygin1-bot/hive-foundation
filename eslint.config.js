import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const HEADLESS_GLOBALS = ['window', 'document', 'localStorage', 'navigator', 'requestAnimationFrame'];

const layer = (files, patterns) => ({
  files,
  rules: {
    'no-restricted-imports': ['error', { patterns }],
    'no-restricted-globals': ['error', ...HEADLESS_GLOBALS],
  },
});

const NO_THREE = { group: ['three', 'three/*'], message: 'This layer is headless: no three.js.' };

export default defineConfig([
  { ignores: ['dist/', 'node_modules/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  layer(['src/core/**/*.ts'], [
    NO_THREE,
    { group: ['**/content/**', '**/sim/**', '**/render/**', '**/ui/**', '**/game/**'], message: 'core must not import other layers.' },
  ]),
  layer(['src/content/**/*.ts'], [
    NO_THREE,
    { group: ['**/sim/**', '**/render/**', '**/ui/**', '**/game/**'], message: 'content may import only core.' },
  ]),
  layer(['src/sim/**/*.ts'], [
    NO_THREE,
    { group: ['**/render/**', '**/ui/**', '**/game/**'], message: 'sim may import only core and content.' },
  ]),
  {
    files: ['src/render/**/*.ts', 'src/ui/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['**/game/**'], message: 'render/ui receive what they need through parameters; never import game/.' }],
      }],
    },
  },
]);
