import { $ } from 'bun';

/** Built app bundle produced by the stable desktop build. */
const DESKTOP_INSTALL_MAC_BUILT_APP = 'desktop_build/stable-macos-arm64/BevyBroom.app';

/** Location the app is installed to. */
const DESKTOP_INSTALL_MAC_TARGET_APP = '/Applications/BevyBroom.app';

/**
 * Builds the stable desktop app, replaces the copy in /Applications and
 * launches it. Quits a running copy first.
 */
async function desktopInstallMacRun(): Promise<void> {
  if (process.platform !== 'darwin') {
    throw new Error('desktop install only runs on macOS');
  }
  await $`bun run desktop:build`;
  await $`pkill -f ${DESKTOP_INSTALL_MAC_TARGET_APP}`.nothrow().quiet();
  await $`rm -rf ${DESKTOP_INSTALL_MAC_TARGET_APP}`;
  await $`ditto ${DESKTOP_INSTALL_MAC_BUILT_APP} ${DESKTOP_INSTALL_MAC_TARGET_APP}`;
  await $`open ${DESKTOP_INSTALL_MAC_TARGET_APP}`;
  console.log(`Installed ${DESKTOP_INSTALL_MAC_TARGET_APP}`);
}

await desktopInstallMacRun();
