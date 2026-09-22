import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Customer applications own their test runners and private runtime directories.
  test: { include: ['tests/**/*.{test,spec}.{ts,tsx}'] },
});
