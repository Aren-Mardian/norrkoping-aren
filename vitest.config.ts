import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'shared/**/*.test.ts', 'netlify/**/*.test.ts'],
    environment: 'node',
  },
});
