import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [],
  resolve: {
    tsconfigPaths: true,
  },
  // Relative base so GitHub Pages project sites resolve index.js next to index.html.
  base: './',
  server: {
    watch: {
      // On Windows a watched folder cannot be renamed, which makes the desktop
      // build fail with AccessDenied while the dev server runs.
      ignored: ['**/.hutch/**', '**/desktop_build/**', '**/desktop_artifacts/**', '**/bevy/target/**'],
    },
  },
  build: {
    outDir: 'docs',
    // Single-file app bundle so GitHub Pages never needs lazy chunk URLs.
    cssCodeSplit: false,
    // Keep short snap WAVs inside index.js (data URLs), not separate assets.
    assetsInlineLimit: 100_000,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'index.js',
        assetFileNames: '[name][extname]',
      },
    },
  },
});
