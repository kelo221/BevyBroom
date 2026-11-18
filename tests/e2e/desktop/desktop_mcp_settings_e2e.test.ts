import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import { e2eRequiredConfigurationAssert, e2eWindowsShownRead } from '../preview_e2e_environment.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';

/**
 * End-to-end acceptance of the MCP settings in the built desktop app: the
 * command search finds MCP Server Settings under Help and no AI Captures debug
 * window under Window, and the MCP server keeps answering tools. Skipped unless
 * BROOM_E2E_DESKTOP_EXE names the app launcher.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_MCP_SETTINGS_MCP_PORT'] ?? '19125');
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;

/** One row of a get_open_menus reply. */
interface McpSettingsE2eRow {
  label: string;
  path?: string;
}

/** One menu of a get_open_menus reply. */
interface McpSettingsE2eMenu {
  kind: 'menu' | 'command_search';
  rows: McpSettingsE2eRow[];
}

describe.skipIf(desktopExecutable === '')('desktop MCP settings end to end', () => {
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
   * Types a query into the command search and reads its rows, then closes it.
   *
   * @param query Search text.
   * @returns Rows the search shows.
   */
  async function commandSearchRowsRead(query: string): Promise<McpSettingsE2eRow[]> {
    await client.toolCallExpectOk('keyboard_input', { code: 'KeyP', keys: { ctrl: true, shift: true } });
    await client.toolCallExpectOk('keyboard_input', { text: query });
    const menus = (await client.toolDataExpectOk<{ menus: McpSettingsE2eMenu[] }>('get_open_menus')).menus;
    await client.toolCallExpectOk('keyboard_input', { code: 'Escape' });
    return menus.find((menu) => menu.kind === 'command_search')?.rows ?? [];
  }

  beforeAll(async () => {
    await appLaunch();
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await app.stop();
  });

  it(
    'finds MCP Server Settings under Help and no AI Captures window under Window',
    async () => {
      const mcpRows = await commandSearchRowsRead('mcp server settings');
      expect(mcpRows[0]).toMatchObject({ label: 'MCP Server Settings…', path: 'Help' });
      const captureRows = await commandSearchRowsRead('ai captures');
      expect(captureRows.filter((row) => row.label.includes('AI Captures'))).toEqual([]);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
