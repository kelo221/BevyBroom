import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import { e2eRequiredConfigurationAssert, e2eWindowsShownRead } from '../preview_e2e_environment.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';

/**
 * End-to-end acceptance of tool options in the right dock in the built desktop
 * app: Face Select opens the Face Edit Sheet as the face tool's options inside
 * the right dock, showing the dock when it was hidden, and no Face Edit Sheet
 * window exists. Skipped unless BROOM_E2E_DESKTOP_EXE names the app launcher.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_TOOL_OPTIONS_MCP_PORT'] ?? '19125');
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;

/** Parts of a get_face_edit_state reply the steps read. */
interface ToolOptionsE2eFaceEditState {
  activeTool: string;
  faceEditSheetOpen: boolean;
}

describe.skipIf(desktopExecutable === '')('desktop tool options in the right dock end to end', () => {
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
   * Reads the width of the right dock on screen.
   *
   * @returns Width in CSS pixels.
   */
  async function inspectorWidthRead(): Promise<number> {
    return (await client.toolDataExpectOk<{ inspector: { width: number } }>('get_shell_layout')).inspector.width;
  }

  beforeAll(async () => {
    await appLaunch();
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await client.toolCall('set_main_window', { inspectorVisible: true });
    await app.stop();
  });

  it(
    'opens the Face Edit Sheet inside the right dock when Face Select starts and shows the hidden dock',
    async () => {
      await client.toolCallExpectOk('set_main_window', { inspectorVisible: false });
      expect(await inspectorWidthRead()).toBe(0);
      await client.toolCallExpectOk('keyboard_input', { code: 'Tab', keys: { shift: true } });
      const state = await desktopE2eWaitUntil(
        'Face Select with the Face Edit Sheet open',
        async () => {
          const read = await client.toolDataExpectOk<ToolOptionsE2eFaceEditState>('get_face_edit_state');
          return read.activeTool === 'face' && read.faceEditSheetOpen ? read : null;
        },
        STEP_TIMEOUT_MILLISECONDS,
      );
      expect(state.faceEditSheetOpen).toBe(true);
      expect(await inspectorWidthRead()).toBeGreaterThan(0);
      const toolWindows = (await client.toolDataExpectOk<{ toolWindows: Record<string, unknown> }>('get_main_window'))
        .toolWindows;
      expect(Object.keys(toolWindows)).not.toContain('face_edit_sheet');
      expect(Object.keys(toolWindows)).not.toContain('entity_sprinkle');
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );
});
