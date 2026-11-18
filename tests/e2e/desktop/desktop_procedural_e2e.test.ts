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
 * saved scene document holds its parameters, undo removes it again, and
 * dragging the arrow of a box's top face handle in the front view moves only
 * that face, straight up and snapped. Skipped unless BROOM_E2E_DESKTOP_EXE
 * names the app launcher.
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
  handleFaces: string[];
  defaultParameters: Record<string, unknown>;
}

/** One handle of a get_entity_handles reply. */
interface ProceduralE2eHandle {
  name: string;
  position: { x: number; y: number; z: number };
  arrows: { tip: { x: number; y: number; z: number } }[];
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
    'lists the box generator with a handle on each face and no corner points',
    async () => {
      const { generators } = await client.toolDataExpectOk<{ generators: ProceduralE2eGenerator[] }>(
        'list_procedural_generators',
      );
      const box = generators.find((generator) => generator.id === PROCEDURAL_GENERATOR_BOX_ID);
      expect(box?.handlePoints).toEqual([]);
      expect(new Set(box?.handleFaces)).toEqual(new Set(['min_x', 'max_x', 'min_y', 'max_y', 'min_z', 'max_z']));
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

  it(
    'moves only the top face, straight up and snapped, when its arrow is dragged diagonally in the front view',
    async () => {
      boxId = (await client.toolDataExpectOk<{ id: string }>('add_procedural', { position: { x: 0, y: 0, z: 0 } })).id;
      const before = (await boxEntryRead())?.procedural?.parameters ?? {};
      const cornerA = before[PROCEDURAL_GENERATOR_BOX_CORNER_A] as number[];
      const cornerB = before[PROCEDURAL_GENERATOR_BOX_CORNER_B] as number[];
      const center = {
        x: ((cornerA[0] ?? 0) + (cornerB[0] ?? 0)) / 2,
        y: ((cornerA[1] ?? 0) + (cornerB[1] ?? 0)) / 2,
        z: 0,
      };
      await client.toolCallExpectOk('viewport_click', { view: 'front', at: center });
      const topHandle = await desktopE2eWaitUntil(
        'the top face handle with its arrow in the front view',
        async () => {
          const read = await client.toolCall('get_entity_handles', { id: boxId, view: 'front' });
          const handles = (read.data as { handles?: ProceduralE2eHandle[] } | undefined)?.handles ?? [];
          return handles.find((handle) => handle.name.endsWith('max_y') && handle.arrows.length === 1) ?? null;
        },
        STEP_TIMEOUT_MILLISECONDS,
      );
      const tip = topHandle.arrows[0]?.tip ?? topHandle.position;
      const grab = {
        x: topHandle.position.x + (tip.x - topHandle.position.x) * 0.6,
        y: topHandle.position.y + (tip.y - topHandle.position.y) * 0.6,
        z: topHandle.position.z + (tip.z - topHandle.position.z) * 0.6,
      };
      const release = { x: grab.x + 0.9, y: grab.y + 1.37, z: grab.z };
      await client.toolCallExpectOk('viewport_drag', { view: 'front', from: grab, to: release });
      const after = (await boxEntryRead())?.procedural?.parameters ?? {};
      const step = (await client.toolDataExpectOk<{ interval: number }>('get_snap_settings')).interval || 1;
      const tops = [after[PROCEDURAL_GENERATOR_BOX_CORNER_A], after[PROCEDURAL_GENERATOR_BOX_CORNER_B]].map(
        (corner) => (corner as number[])[1] ?? 0,
      );
      expect(Math.max(...tops)).toBeCloseTo(Math.round((topHandle.position.y + 1.37) / step) * step, 4);
      expect(Math.min(...tops)).toBeCloseTo(Math.min(cornerA[1] ?? 0, cornerB[1] ?? 0), 6);
      expect((after[PROCEDURAL_GENERATOR_BOX_CORNER_A] as number[])[0]).toBeCloseTo(cornerA[0] ?? 0, 6);
      expect((after[PROCEDURAL_GENERATOR_BOX_CORNER_B] as number[])[0]).toBeCloseTo(cornerB[0] ?? 0, 6);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
