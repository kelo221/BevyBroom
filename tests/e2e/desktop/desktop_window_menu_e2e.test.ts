import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import { e2eRequiredConfigurationAssert, e2eWindowsShownRead } from '../preview_e2e_environment.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';

/**
 * End-to-end acceptance of the Window menu in the built desktop app: the menu
 * bar lists Window before Help, each Browser tab opens and closes from its
 * default shortcut, all tabs share one Browser window, and the command search
 * finds the Browser tabs under Window. Skipped unless BROOM_E2E_DESKTOP_EXE
 * names the app launcher.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_WINDOW_MENU_MCP_PORT'] ?? '19125');
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;

/** Browser tab ids the browser shortcuts open. */
type WindowMenuE2eWindowId = 'texture_browser' | 'entity_browser' | 'level_browser';

/** Parts of a get_main_window reply the steps read. */
interface WindowMenuE2eMainWindow {
  menus: string[];
  floatingWindows: Record<WindowMenuE2eWindowId, boolean>;
  toolWindows: Record<string, { isOpen: boolean }>;
}

/** One row of a get_open_menus reply. */
interface WindowMenuE2eRow {
  label: string;
  path?: string;
}

/** One menu of a get_open_menus reply. */
interface WindowMenuE2eMenu {
  kind: 'menu' | 'command_search';
  rows: WindowMenuE2eRow[];
}

/** Each Browser tab with the key that opens it together with Ctrl+Shift. */
const WINDOW_MENU_E2E_BROWSER_KEYS: ReadonlyArray<readonly [WindowMenuE2eWindowId, string]> = [
  ['texture_browser', 'KeyT'],
  ['entity_browser', 'KeyB'],
  ['level_browser', 'KeyL'],
];

describe.skipIf(desktopExecutable === '')('desktop Window menu and browser shortcuts end to end', () => {
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
   * @returns Menu titles and floating window states.
   */
  async function mainWindowRead(): Promise<WindowMenuE2eMainWindow> {
    return client.toolDataExpectOk<WindowMenuE2eMainWindow>('get_main_window');
  }

  /**
   * Waits until a floating window is open or closed.
   *
   * @param windowId Floating window id.
   * @param isOpen Expected state.
   */
  async function floatingWindowWait(windowId: WindowMenuE2eWindowId, isOpen: boolean): Promise<void> {
    await desktopE2eWaitUntil(
      `${windowId} to be ${isOpen ? 'open' : 'closed'}`,
      async () => ((await mainWindowRead()).floatingWindows[windowId] === isOpen ? true : null),
      STEP_TIMEOUT_MILLISECONDS,
    );
  }

  beforeAll(async () => {
    await appLaunch();
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await app.stop();
  });

  it(
    'lists the Window menu right before Help',
    async () => {
      const menus = (await mainWindowRead()).menus;
      expect(menus).toContain('Window');
      expect(menus.indexOf('Help')).toBe(menus.indexOf('Window') + 1);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'opens and closes each browser window from its Ctrl+Shift shortcut',
    async () => {
      for (const [windowId, code] of WINDOW_MENU_E2E_BROWSER_KEYS) {
        const wasOpen = (await mainWindowRead()).floatingWindows[windowId];
        await client.toolCallExpectOk('keyboard_input', { code, keys: { ctrl: true, shift: true } });
        await floatingWindowWait(windowId, !wasOpen);
        await client.toolCallExpectOk('keyboard_input', { code, keys: { ctrl: true, shift: true } });
        await floatingWindowWait(windowId, wasOpen);
      }
    },
    STEP_TIMEOUT_MILLISECONDS * 3,
  );

  it(
    'switches the one Browser window between tabs instead of opening another window',
    async () => {
      await client.toolCallExpectOk('keyboard_input', { code: 'KeyB', keys: { ctrl: true, shift: true } });
      await floatingWindowWait('entity_browser', true);
      await client.toolCallExpectOk('keyboard_input', { code: 'KeyT', keys: { ctrl: true, shift: true } });
      await floatingWindowWait('texture_browser', true);
      const mainWindow = await mainWindowRead();
      expect(mainWindow.floatingWindows.entity_browser).toBe(false);
      expect(mainWindow.toolWindows['browser']?.isOpen).toBe(true);
      for (const windowId of WINDOW_MENU_E2E_BROWSER_KEYS.map(([tabWindowId]) => tabWindowId)) {
        expect(mainWindow.toolWindows[windowId]).toBeUndefined();
      }
      await client.toolCallExpectOk('keyboard_input', { code: 'KeyT', keys: { ctrl: true, shift: true } });
      await floatingWindowWait('texture_browser', false);
      expect((await mainWindowRead()).toolWindows['browser']?.isOpen).toBe(false);
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'finds the Browser Place tab under Window in the command search',
    async () => {
      await client.toolCallExpectOk('keyboard_input', { code: 'KeyP', keys: { ctrl: true, shift: true } });
      await client.toolCallExpectOk('keyboard_input', { text: 'browser place' });
      const menus = (await client.toolDataExpectOk<{ menus: WindowMenuE2eMenu[] }>('get_open_menus')).menus;
      const search = menus.find((menu) => menu.kind === 'command_search');
      expect(search?.rows[0]).toMatchObject({ label: 'Browser: Place', path: 'Window' });
      await client.toolCallExpectOk('keyboard_input', { code: 'Escape' });
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
