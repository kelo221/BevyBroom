import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import type { SceneJSON } from '@/io/scene/io_types.js';
import { e2eRequiredConfigurationAssert, e2eWindowsShownRead } from '../preview_e2e_environment.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';
import type { ShellMainWindowState } from '@/layout/shell/actions/shell_main_window_control.js';

/**
 * End-to-end acceptance of the Properties section of the right dock in the
 * built desktop app: it shows the selected light, writes comments as one undo
 * step, empties when nothing is selected, and the Browser's Textures tab.
 * Skipped unless BROOM_E2E_DESKTOP_EXE names the app launcher.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_OBJECT_PROPERTIES_MCP_PORT'] ?? '18965');
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;
const COMMENTS_TEXT = 'e2e object properties note';

/** Data of a get_properties_section reply. */
interface ObjectPropertiesE2eDialogState {
  tab: string | null;
  tabs: string[];
  editedIds: string[];
}

/** Data of a get_editor_context reply. */
interface ObjectPropertiesE2eEditorContext {
  undoCount: number;
}

/**
 * Returns the data of a tool result as a given shape.
 *
 * @param result Successful tool result.
 * @returns The result data.
 */
function toolDataRead<Data>(result: McpToolResult): Data {
  return result.data as Data;
}

/**
 * Reads designer comments of the first matching scene object.
 *
 * @param json Scene file text.
 * @param objectId Object uuid.
 * @returns Comments, or an empty string.
 */
function sceneCommentsRead(json: string, objectId: string): string {
  const scene = JSON.parse(json) as SceneJSON;
  const entry = scene.objects.find((object) => object.uuid === objectId);
  return entry?.objectComments ?? '';
}

describe.skipIf(desktopExecutable === '')('desktop Object Properties end to end', () => {
  const app = new DesktopE2eAppProcess(desktopExecutable, mcpBasePort, e2eWindowsShownRead());
  let client: DesktopE2eMcpClient;
  let lightId = '';

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
   * Reads the Properties section state.
   *
   * @returns Section state.
   */
  async function dialogStateRead(): Promise<ObjectPropertiesE2eDialogState> {
    return toolDataRead<ObjectPropertiesE2eDialogState>(await client.toolCallExpectOk('get_properties_section'));
  }

  /**
   * Reads the editor undo count.
   *
   * @returns Undo count.
   */
  async function undoCountRead(): Promise<number> {
    return toolDataRead<ObjectPropertiesE2eEditorContext>(await client.toolCallExpectOk('get_editor_context'))
      .undoCount;
  }

  /**
   * Reads the open scene file text.
   *
   * @returns Scene JSON text.
   */
  async function sceneJsonRead(): Promise<string> {
    return toolDataRead<{ json: string }>(await client.toolCallExpectOk('get_scene_document')).json;
  }

  beforeAll(async () => {
    await appLaunch();
  }, LAUNCH_TIMEOUT_MILLISECONDS);

  afterAll(async () => {
    await app.stop();
  });

  it(
    'shows a selected light in the right dock Properties section and writes comments as one undo step',
    async () => {
      lightId = toolDataRead<{ id: string }>(
        await client.toolCallExpectOk('add_light', { name: 'PropertiesLight', position: { x: 0, y: 1, z: 0 } }),
      ).id;
      await client.toolCallExpectOk('viewport_click', { view: 'perspective', at: { x: 0, y: 1, z: 0 } });
      const undoBefore = await undoCountRead();
      await client.toolCallExpectOk('set_main_window', { inspectorVisible: false });
      await client.toolCallExpectOk('set_properties_section', { tab: 'class_info' });
      const layout = toolDataRead<{ inspector: { width: number } }>(await client.toolCallExpectOk('get_shell_layout'));
      expect(layout.inspector.width).toBeGreaterThan(0);
      expect((await dialogStateRead()).editedIds).toEqual([lightId]);
      await client.toolCallExpectOk('set_properties_section', { comments: COMMENTS_TEXT });
      expect(sceneCommentsRead(await sceneJsonRead(), lightId)).toBe(COMMENTS_TEXT);
      expect(await undoCountRead()).toBe(undoBefore + 1);
      await client.toolCallExpectOk('undo');
      expect(sceneCommentsRead(await sceneJsonRead(), lightId)).toBe('');
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'empties the Properties section when nothing is selected and refuses comments then',
    async () => {
      await client.toolCallExpectOk('select', { brushIds: [] });
      expect((await dialogStateRead()).editedIds).toEqual([]);
      expect((await client.toolCall('set_properties_section', { comments: COMMENTS_TEXT })).ok).toBe(false);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'toggles the Texture Browser floating window over MCP',
    async () => {
      const opened = toolDataRead<ShellMainWindowState>(
        await client.toolCallExpectOk('set_main_window', { floatingWindows: { texture_browser: true } }),
      );
      expect(opened.floatingWindows.texture_browser).toBe(true);
      const closed = toolDataRead<ShellMainWindowState>(
        await client.toolCallExpectOk('set_main_window', { floatingWindows: { texture_browser: false } }),
      );
      expect(closed.floatingWindows.texture_browser).toBe(false);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
