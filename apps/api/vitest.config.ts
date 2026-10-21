import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['./src/test/global-setup.ts'],
    // All files share one real Postgres test database, so run them one at a time for determinism.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
