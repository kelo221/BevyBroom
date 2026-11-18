import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import { e2eRequiredConfigurationAssert, e2eWindowsShownRead } from '../preview_e2e_environment.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';

/**
 * End-to-end acceptance of the Game Preview tab of the bottom strip in the
 * built desktop app: Run > Game Preview, found and run through the command
 * search, unfolds the folded info panel on its Game Preview tab instead of
 * opening a window. Skipped unless BROOM_E2E_DESKTOP_EXE names the app
 * launcher.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_GAME_PREVIEW_STRIP_MCP_PORT'] ?? '19125');
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;

/** Screen rect of a get_shell_layout area. */
interface GamePreviewStripE2eBounds {
  height: number;
}

/** Parts of a get_main_window reply the steps read. */
interface GamePreviewStripE2eMainWindow {
  infoPanelTab: string;
  infoPanelCollapsed: boolean;
  toolWindows: Record<string, unknown>;
}

/** One row of a get_open_menus reply. */
interface GamePreviewStripE2eRow {
  label: string;
  path?: string;
}

/** One menu of a get_open_menus reply. */
interface GamePreviewStripE2eMenu {
  kind: 'menu' | 'command_search';
  rows: GamePreviewStripE2eRow[];
}

describe.skipIf(desktopExecutable === '')('desktop Game Preview tab of the bottom strip end to end', () => {
  const app = new DesktopE2eAppProcess(desktopExecutable, mcpBasePort, e2eWindowsShownRead());
  let client: DesktopE2eMcpClient;

  /** Starts the app and waits until the editor answers tools. */
  async function appLaunch(): Promise<void> {
    app.start();
    client = new DesktopE2eMcpClient(await app.mcpUrlWait(LAUNCH_TIMEOUT_MILLISECONDS));
    await client.initialize();
    await desktopE2eWaitUntil(
      'the editor to answer tools',
      async () => ((await client.toolCall('get_editor_context')).ok ? true : null),
      LAUNCH_TIMEOUT_MILLISECONDS,
    );
  }

  /**
   * Reads the main window arrangement.
   *
   * @returns Info panel state and tool windows.
   */
  async function mainWindowRead(): Promise<GamePreviewStripE2eMainWindow> {
    return client.toolDataExpectOk<GamePreviewStripE2eMainWindow>('get_main_window');
  }

  /**
   * Reads the height of the info panel on screen.
   *
   * @returns Height in CSS pixels.
   */
  async function infoPanelHeightRead(): Promise<number> {
    return (await client.toolDataExpectOk<{ infoPanel: GamePreviewStripE2eBounds }>('get_shell_layout')).infoPanel
      .height;
  }

  beforeAll(async () => {
    await appLaunch();
    await client.toolCallExpectOk('set_main_window', {
      infoPanelVisible: true,
      infoPanelCollapsed: true,
      infoPanelTab: 'console',
    });
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await client.toolCall('set_main_window', { infoPanelCollapsed: true, infoPanelTab: 'console' });
    await app.stop();
  });

  it(
    'runs Run > Game Preview from the command search and unfolds the strip on its Game Preview tab',
    async () => {
      const foldedHeight = await infoPanelHeightRead();
      await client.toolCallExpectOk('keyboard_input', { code: 'KeyP', keys: { ctrl: true, shift: true } });
      await client.toolCallExpectOk('keyboard_input', { text: 'game preview' });
      const menus = (await client.toolDataExpectOk<{ menus: GamePreviewStripE2eMenu[] }>('get_open_menus')).menus;
      const search = menus.find((menu) => menu.kind === 'command_search');
      expect(search?.rows[0]).toMatchObject({ label: 'Game Preview', path: 'Run' });
      await client.toolCallExpectOk('keyboard_input', { code: 'Enter' });
      const mainWindow = await desktopE2eWaitUntil(
        'the info panel to unfold on Game Preview',
        async () => {
          const read = await mainWindowRead();
          return read.infoPanelTab === 'preview' && !read.infoPanelCollapsed ? read : null;
        },
        STEP_TIMEOUT_MILLISECONDS,
      );
      expect(Object.keys(mainWindow.toolWindows)).not.toContain('game_preview');
      expect(await infoPanelHeightRead()).toBeGreaterThan(foldedHeight);
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );
});
