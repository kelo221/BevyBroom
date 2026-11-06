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
 * End-to-end acceptance of the Object Properties dialog in the built desktop
 * app: comments Cancel/Apply, a foreign set_logic_outputs call while the dialog
 * is open, and the Texture Browser floating window. Skipped unless
 * BROOM_E2E_DESKTOP_EXE names the app launcher.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_OBJECT_PROPERTIES_MCP_PORT'] ?? '18965');
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;
const COMMENTS_TEXT = 'e2e object properties note';

/** Data of a get_object_properties_dialog reply. */
interface ObjectPropertiesE2eDialogState {
  open: boolean;
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
  let doorId = '';

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
   * Reads the Object Properties dialog state.
   *
   * @returns Dialog state.
   */
  async function dialogStateRead(): Promise<ObjectPropertiesE2eDialogState> {
    return toolDataRead<ObjectPropertiesE2eDialogState>(await client.toolCallExpectOk('get_object_properties_dialog'));
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
    'opens Object Properties on a selected light, cancels comments, then applies them',
    async () => {
      lightId = toolDataRead<{ id: string }>(
        await client.toolCallExpectOk('add_light', { name: 'PropertiesLight', position: { x: 0, y: 1, z: 0 } }),
      ).id;
      await client.toolCallExpectOk('viewport_click', {
        view: 'perspective',
        at: { x: 0, y: 1, z: 0 },
      });
      const undoBeforeOpen = await undoCountRead();
      const opened = await client.toolCallExpectOk('set_object_properties_dialog', { action: 'open' });
      expect(toolDataRead<ObjectPropertiesE2eDialogState>(opened).open).toBe(true);
      expect((await dialogStateRead()).editedIds).toEqual([lightId]);
      await client.toolCallExpectOk('set_object_properties_dialog', { comments: COMMENTS_TEXT });
      expect(sceneCommentsRead(await sceneJsonRead(), lightId)).toBe(COMMENTS_TEXT);
      await client.toolCallExpectOk('set_object_properties_dialog', { action: 'cancel' });
      expect((await dialogStateRead()).open).toBe(false);
      expect(sceneCommentsRead(await sceneJsonRead(), lightId)).toBe('');
      expect(await undoCountRead()).toBe(undoBeforeOpen);
      await client.toolCallExpectOk('viewport_click', { view: 'perspective', at: { x: 0, y: 1, z: 0 } });
      await client.toolCallExpectOk('set_object_properties_dialog', { action: 'open', comments: COMMENTS_TEXT });
      await client.toolCallExpectOk('set_object_properties_dialog', { action: 'apply' });
      expect(sceneCommentsRead(await sceneJsonRead(), lightId)).toBe(COMMENTS_TEXT);
      expect(await undoCountRead()).toBe(undoBeforeOpen + 1);
      await client.toolCallExpectOk('undo');
      expect(sceneCommentsRead(await sceneJsonRead(), lightId)).toBe('');
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'keeps session comments when a foreign set_logic_outputs lands while the dialog is open',
    async () => {
      doorId = toolDataRead<{ id: string }>(
        await client.toolCallExpectOk('add_game_entity', {
          name: 'PropertiesDoor',
          position: { x: 2, y: 0, z: 0 },
        }),
      ).id;
      await client.toolCallExpectOk('viewport_click', { view: 'perspective', at: { x: 0, y: 1, z: 0 } });
      await client.toolCallExpectOk('set_object_properties_dialog', { action: 'open', comments: COMMENTS_TEXT });
      await client.toolCallExpectOk('set_logic_outputs', {
        id: doorId,
        outputs: [{ output: 'OnPressed', target: 'PropertiesDoor', input: 'Open' }],
      });
      expect((await dialogStateRead()).open).toBe(true);
      await client.toolCallExpectOk('set_object_properties_dialog', { action: 'cancel' });
      expect(sceneCommentsRead(await sceneJsonRead(), lightId)).toBe(COMMENTS_TEXT);
      const outputs = toolDataRead<{ outputs: unknown[] }>(
        await client.toolCallExpectOk('read_logic_outputs', { id: doorId }),
      );
      expect(outputs.outputs).toHaveLength(1);
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
