import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { electrobunViteAliases } from './.hutch/devkit/api/config/electrobun-vite.js';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

/**
 * Builds the desktop window page (`src/desktop/main_ui`) into
 * `desktop_view_dist/`, which `electrobun.config.ts` copies to
 * `views/main_ui/`. Electrobun 2.x SDK imports resolve to the devkit Hutch
 * projects into `.hutch/devkit`, so run `electrobun prepare` before this
 * build.
 */
export default defineConfig({
  root: `${projectRoot}src/desktop/main_ui`,
  base: './',
  publicDir: false,
  resolve: {
    tsconfigPaths: true,
    alias: electrobunViteAliases(`${projectRoot}.hutch/devkit`),
  },
  build: {
    outDir: `${projectRoot}desktop_view_dist`,
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 4096,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000,
    rolldownOptions: {
      output: {
        codeSplitting: false,
        entryFileNames: 'index.js',
        assetFileNames: '[name][extname]',
      },
    },
  },
});
