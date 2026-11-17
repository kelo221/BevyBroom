import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import {
  PROCEDURAL_GENERATOR_BOX_CORNER_A,
  PROCEDURAL_GENERATOR_BOX_CORNER_B,
  PROCEDURAL_GENERATOR_BOX_ID,
} from '@/procedural/generator/box/procedural_generator_box.js';
import { PROCEDURAL_ENTITY_KIND } from '@/procedural/model/procedural_definition.js';
import { e2eRequiredConfigurationAssert, e2eWindowsShownRead } from '../preview_e2e_environment.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';

/**
 * End-to-end acceptance of the procedural object tools in the built desktop
 * app: the generators are listed, a box is added and resized through MCP, the
 * saved scene document holds its parameters, and undo removes it again. Skipped
 * unless BROOM_E2E_DESKTOP_EXE names the app launcher.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_PROCEDURAL_MCP_PORT'] ?? '19145');
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;

/**
 * How long the scene document must stay unchanged before the startup counts as
 * settled.
 */
const SCENE_SETTLED_MILLISECONDS = 3000;

/** Corner B of the box after the resize. */
const CORNER_B_RESIZED = [2.5, 3, 1.5];

/** One generator of a list_procedural_generators reply. */
interface ProceduralE2eGenerator {
  id: string;
  handlePoints: string[];
  defaultParameters: Record<string, unknown>;
}

/** One object entry of a scene document. */
interface ProceduralE2eSceneEntry {
  uuid: string;
  type: string;
  procedural?: { generatorId: string; parameters: Record<string, unknown> };
  [key: string]: unknown;
}

describe.skipIf(desktopExecutable === '')('desktop procedural object tools end to end', () => {
  const app = new DesktopE2eAppProcess(desktopExecutable, mcpBasePort, e2eWindowsShownRead());
  let client: DesktopE2eMcpClient;
  let boxId = '';

  beforeAll(async () => {
    app.start();
    client = new DesktopE2eMcpClient(await app.mcpUrlWait(LAUNCH_TIMEOUT_MILLISECONDS));
    await client.initialize();
    await desktopE2eWaitUntil(
      'the editor to answer tools',
      async () => ((await client.toolCall('get_editor_context')).ok ? true : null),
      LAUNCH_TIMEOUT_MILLISECONDS,
    );
    await sceneSettledWait();
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await app.stop();
  });

  /**
   * Waits until the scene document stopped changing, so a level the app reopens
   * at startup cannot replace the scene after the box was added (issue #50).
   */
  async function sceneSettledWait(): Promise<void> {
    let lastText = '';
    let unchangedSince = performance.now();
    await desktopE2eWaitUntil(
      'the scene to settle after startup',
      async () => {
        const text = (await client.toolDataExpectOk<{ json: string }>('get_scene_document')).json;
        if (text !== lastText) {
          lastText = text;
          unchangedSince = performance.now();
        }
        return performance.now() - unchangedSince >= SCENE_SETTLED_MILLISECONDS ? true : null;
      },
      LAUNCH_TIMEOUT_MILLISECONDS,
    );
  }

  /**
   * Returns the scene document entry of the box.
   *
   * @returns The entry, or undefined when the document holds no such object.
   */
  async function boxEntryRead(): Promise<ProceduralE2eSceneEntry | undefined> {
    const document = await client.toolDataExpectOk<{ json: string }>('get_scene_document');
    const objects = (JSON.parse(document.json) as { objects?: ProceduralE2eSceneEntry[] }).objects ?? [];
    return objects.find((entry) => entry.uuid === boxId);
  }

  it(
    'lists the box generator with its corner handles',
    async () => {
      const { generators } = await client.toolDataExpectOk<{ generators: ProceduralE2eGenerator[] }>(
        'list_procedural_generators',
      );
      const box = generators.find((generator) => generator.id === PROCEDURAL_GENERATOR_BOX_ID);
      expect(box?.handlePoints).toEqual([PROCEDURAL_GENERATOR_BOX_CORNER_A, PROCEDURAL_GENERATOR_BOX_CORNER_B]);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'adds and resizes a box whose parameters the scene document keeps',
    async () => {
      boxId = (await client.toolDataExpectOk<{ id: string }>('add_procedural', { position: { x: 0, y: 0, z: 0 } })).id;
      await client.toolCallExpectOk('set_procedural_settings', {
        id: boxId,
        settings: { parameters: { [PROCEDURAL_GENERATOR_BOX_CORNER_B]: CORNER_B_RESIZED } },
      });
      const entry = await boxEntryRead();
      expect(entry?.type).toBe(PROCEDURAL_ENTITY_KIND);
      expect(JSON.stringify(entry)).toContain(JSON.stringify(CORNER_B_RESIZED));
      const picture = await client.toolCallExpectOk('capture_view', {});
      expect(picture.images?.[0]?.data.length ?? 0).toBeGreaterThan(0);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'removes the box with two undo steps',
    async () => {
      await client.toolCallExpectOk('undo');
      expect(JSON.stringify(await boxEntryRead())).not.toContain(JSON.stringify(CORNER_B_RESIZED));
      await client.toolCallExpectOk('undo');
      expect(await boxEntryRead()).toBeUndefined();
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
