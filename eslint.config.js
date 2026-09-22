import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Correctness rules only. Formatting is not enforced: on a project this size
 * it generates noise without catching anything, and the type checker already
 * covers what matters.
 */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // A dropped promise loses both its result and its rejection. In a UI
      // that fires a request per keystroke, this is the bug that shows up as
      // "sometimes nothing happens".
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // Casts and assertions are how bad external data entered this codebase
      // once already: `answer as { score: number }` in the first sift.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // The CLI and bench are console programs; logging is their output.
    files: ['src/*.mts'],
    rules: { 'no-console': 'off' },
  },
  {
    // `node:test` drives the promise each `test()` returns; awaiting it at the
    // top level is not how the runner is used. The rule stays on everywhere
    // else, where a dropped promise really does lose its result.
    files: ['src/**/*.test.ts'],
    rules: { '@typescript-eslint/no-floating-promises': 'off' },
  },
  {
    // Config files and browser scripts sit outside tsconfig's `include`, so
    // the type-aware parser has no program for them. Lint them without type
    // information.
    files: ['*.js', 'web/**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      // Hand-listed, and the list has already come up short once: `?clean`
      // added `URLSearchParams` and `location` and lint went red on a change
      // that was correct. Add the global when that happens rather than
      // reaching for an eslint-disable.
      globals: {
        document: 'readonly',
        window: 'readonly',
        location: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        AbortController: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        requestAnimationFrame: 'readonly',
        console: 'readonly',
      },
      parserOptions: { projectService: false, project: null },
    },
  },
  { ignores: ['node_modules/', 'dist/', 'web/dist/'] },
);
