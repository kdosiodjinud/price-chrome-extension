import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/** This project is ESM, so `projectRoot` does not exist; derive it. */
const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: { '@': resolve(projectRoot, 'src') },
  },
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    // Pure logic runs in node; the DOM rewriting tests opt into jsdom with a
    // per-file `@vitest-environment` comment.
    environment: 'node',
  },
});
