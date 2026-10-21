import { build } from 'vite';

/**
 * Builds the desktop window page with `vite.desktop.config.ts` into
 * `desktop_view_dist/`. Electrobun runs this as its `preBuild` script, after
 * Hutch has projected the SDK into `.hutch/devkit`, and then copies the output
 * into the app.
 */
async function desktopViewBuild(): Promise<void> {
  await build({ configFile: 'vite.desktop.config.ts', logLevel: 'warn' });
  console.log('Built the desktop page into desktop_view_dist');
}

await desktopViewBuild();
