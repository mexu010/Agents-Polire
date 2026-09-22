import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['data/**', 'work/**', 'dist/**', 'node_modules/**', 'clients/**/data/**', 'clients/**/work/**', 'clients/**/test-results/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['clients/coiffeur-lanz/**/*.mjs'],
    languageOptions: { globals: Object.fromEntries(['process', 'Buffer', 'URL', 'fetch', 'AbortSignal', 'structuredClone', 'setInterval', 'clearInterval', 'console'].map(name => [name, 'readonly'])) },
  },
  {
    files: ['clients/coiffeur-lanz/public/assets/*.js', 'clients/coiffeur-lanz/check-*.mjs'],
    languageOptions: { globals: Object.fromEntries(['document', 'window', 'navigator', 'location', 'HTMLElement', 'FormData', 'fetch', 'URL', 'FileReader', 'confirm', 'structuredClone', 'setTimeout', 'innerWidth'].map(name => [name, 'readonly'])) },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-fallthrough': 'error',
      'no-unreachable': 'error',
    },
  },
);
