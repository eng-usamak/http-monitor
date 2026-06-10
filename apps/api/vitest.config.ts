import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // mongodb-memory-server downloads a mongod binary on first run.
    hookTimeout: 120_000,
    coverage: {
      include: ['src/**'],
      exclude: ['src/index.ts', 'src/**/*.test.ts', 'src/test/**'],
    },
  },
});
