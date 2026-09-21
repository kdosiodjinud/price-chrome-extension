import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/** This project is ESM, so `projectRoot` does not exist; derive it. */
const projectRoot = fileURLToPath(new URL('.', import.meta.url));

/**
 * The content script is injected into arbitrary pages, so it must be a single
 * self-contained IIFE with no import statements and no shared chunks.
 */
export default defineConfig({
  resolve: {
    alias: { '@': resolve(projectRoot, 'src') },
  },
  build: {
    outDir: resolve(projectRoot, 'dist'),
    // The pages build runs first and owns emptying the output directory.
    emptyOutDir: false,
    target: 'chrome110',
    sourcemap: false,
    cssCodeSplit: false,
    lib: {
      entry: resolve(projectRoot, 'src/content/content.ts'),
      formats: ['iife'],
      name: 'PriceExtensionContent',
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: { extend: true },
    },
  },
});
