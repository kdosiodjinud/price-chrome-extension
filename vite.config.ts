import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/** This project is ESM, so `projectRoot` does not exist; derive it. */
const projectRoot = fileURLToPath(new URL('.', import.meta.url));

/**
 * Build for everything that runs as an ES module inside the extension:
 * the MV3 service worker and the two extension pages (options, popup).
 *
 * The content script is built separately (vite.content.config.ts) because
 * MV3 content scripts are not ES modules and must ship as a single IIFE.
 */
export default defineConfig({
  root: resolve(projectRoot, 'src'),
  publicDir: resolve(projectRoot, 'public'),
  resolve: {
    alias: { '@': resolve(projectRoot, 'src') },
  },
  build: {
    outDir: resolve(projectRoot, 'dist'),
    emptyOutDir: true,
    target: 'chrome110',
    sourcemap: false,
    // Data: URIs would violate the extension CSP, so never inline assets.
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        'service-worker': resolve(projectRoot, 'src/background/service-worker.ts'),
        options: resolve(projectRoot, 'src/options/index.html'),
        popup: resolve(projectRoot, 'src/popup/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
