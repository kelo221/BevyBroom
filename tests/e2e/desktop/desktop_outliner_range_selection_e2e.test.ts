import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import { e2eRequiredConfigurationAssert, e2eWindowsShownRead } from '../preview_e2e_environment.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';

/**
 * End-to-end acceptance of outliner range selection in the built desktop app: a
 * plain click and a Shift click on outliner rows select every row between them,
 * top to bottom and bottom to top, Ctrl toggles one row, and no click leaves
 * page text selected. Skipped unless BROOM_E2E_DESKTOP_EXE names the app
 * launcher.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_OUTLINER_RANGE_MCP_PORT'] ?? '19125');
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;

/** Number of solid models the steps click through. */
const OUTLINER_RANGE_E2E_MODEL_COUNT = 5;

/** Parts of an outliner_click reply the steps read. */
interface OutlinerRangeE2eClick {
  selection: { solidModelIds: string[] };
  pageSelectedText: string;
}

describe.skipIf(desktopExecutable === '')('desktop outliner range selection end to end', () => {
  const app = new DesktopE2eAppProcess(desktopExecutable, mcpBasePort, e2eWindowsShownRead());
  let client: DesktopE2eMcpClient;
  const modelIds: string[] = [];

  /**
   * Clicks the outliner row of a solid model.
   *
   * @param modelIndex Index of the model in creation order.
   * @param keys Held modifier keys.
   * @returns Selection and page text selected after the click.
   */
  async function rowClick(
    modelIndex: number,
    keys: { shift?: boolean; ctrl?: boolean } = {},
  ): Promise<OutlinerRangeE2eClick> {
    return client.toolDataExpectOk<OutlinerRangeE2eClick>('outliner_click', { id: modelIds[modelIndex], ...keys });
  }

  /**
   * Returns the ids of a run of models in creation order.
   *
   * @param firstIndex First model index.
   * @param lastIndex Last model index, inclusive.
   * @returns Model ids as a set.
   */
  function modelIdRun(firstIndex: number, lastIndex: number): Set<string> {
    return new Set(modelIds.slice(firstIndex, lastIndex + 1));
  }

  beforeAll(async () => {
    app.start();
    client = new DesktopE2eMcpClient(await app.mcpUrlWait(LAUNCH_TIMEOUT_MILLISECONDS));
    await client.initialize();
    await desktopE2eWaitUntil(
      'the editor to answer tools',
      async () => ((await client.toolCall('get_editor_context')).ok ? true : null),
      LAUNCH_TIMEOUT_MILLISECONDS,
    );
    await client.toolCallExpectOk('set_main_window', { inspectorVisible: true });
    for (let index = 0; index < OUTLINER_RANGE_E2E_MODEL_COUNT; index += 1) {
      const created = await client.toolDataExpectOk<{ modelId: string }>('create_solid_model', {
        name: `OutlinerRange${index}`,
      });
      modelIds.push(created.modelId);
    }
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await app.stop();
  });

  it(
    'selects every row between a click and a Shift click, downwards and upwards, without selecting text',
    async () => {
      await desktopE2eWaitUntil(
        'the outliner rows',
        async () => ((await client.toolCall('outliner_click', { id: modelIds[1] })).ok ? true : null),
        STEP_TIMEOUT_MILLISECONDS,
      );
      const down = await rowClick(3, { shift: true });
      expect(new Set(down.selection.solidModelIds)).toEqual(modelIdRun(1, 3));
      expect(down.pageSelectedText).toBe('');
      await rowClick(4);
      const up = await rowClick(2, { shift: true });
      expect(new Set(up.selection.solidModelIds)).toEqual(modelIdRun(2, 4));
      expect(up.pageSelectedText).toBe('');
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'toggles a single row with Ctrl',
    async () => {
      await rowClick(0);
      const toggled = await rowClick(4, { ctrl: true });
      expect(new Set(toggled.selection.solidModelIds)).toEqual(new Set([modelIds[0], modelIds[4]]));
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
