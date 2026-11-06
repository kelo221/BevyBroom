import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { e2eRequiredConfigurationAssert, e2eWindowsShownRead } from '../preview_e2e_environment.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';

/**
 * End-to-end acceptance of select_adjacent_displacements in the built desktop
 * app: three boxes are added, two touching and one far away, their top faces
 * are displaced, and selecting adjacent displacements from the first top face
 * adds the touching neighbour's top face to the editor's face selection but not
 * the distant one. Skipped unless BROOM_E2E_DESKTOP_EXE names the app
 * launcher.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_DISPLACEMENT_MCP_PORT'] ?? '18985');
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;
const BOX_SIZE = 2;

/** One face of a select_adjacent_displacements reply. */
interface DisplacementSelectE2eFace {
  brushId: string;
  faceIndex: number;
  displaced: boolean;
}

/** One plane of a full get_brush reply. */
interface DisplacementSelectE2ePlane {
  normal: { x: number; y: number; z: number };
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

describe.skipIf(desktopExecutable === '')('desktop app displacement selection end to end', () => {
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
   * Adds a box brush and gives its upward face a displacement.
   *
   * @param modelId Model receiving the box.
   * @param x World X of the box center.
   * @returns Brush id and the displaced face index.
   */
  async function displacedBoxAdd(modelId: string, x: number): Promise<{ brushId: string; faceIndex: number }> {
    const added = await client.toolCallExpectOk('add_box_brush', {
      modelId,
      size: BOX_SIZE,
      position: { x, y: BOX_SIZE / 2, z: 0 },
    });
    const brushId = toolDataRead<{ brushId: string }>(added).brushId;
    const faceIndex = await upwardFaceRead(brushId);
    await client.toolCallExpectOk('set_face_displacement', { brushId, faceIndex, action: 'create', power: 2 });
    return { brushId, faceIndex };
  }

  /**
   * Finds the face of a brush whose plane points most upwards.
   *
   * @param brushId Brush id.
   * @returns Face index.
   */
  async function upwardFaceRead(brushId: string): Promise<number> {
    const brush = await client.toolCallExpectOk('get_brush', { brushId, detail: 'full' });
    const planes = toolDataRead<{ geometry: { planes: DisplacementSelectE2ePlane[] } }>(brush).geometry.planes;
    let bestIndex = -1;
    planes.forEach((plane, index) => {
      const best = planes[bestIndex];
      if (!best || plane.normal.y > best.normal.y) bestIndex = index;
    });
    return bestIndex;
  }

  beforeAll(async () => {
    await appLaunch();
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await app.stop();
  });

  it(
    'selects the touching displaced face and not the distant one',
    async () => {
      const model = await client.toolCallExpectOk('create_solid_model', { name: 'DisplacementSelectE2e' });
      const modelId = toolDataRead<{ modelId: string }>(model).modelId;
      const first = await displacedBoxAdd(modelId, 0);
      const neighbour = await displacedBoxAdd(modelId, BOX_SIZE);
      const distant = await displacedBoxAdd(modelId, BOX_SIZE * 6);
      const result = await client.toolCallExpectOk('select_adjacent_displacements', { faces: [first] });
      const data = toolDataRead<{ addedCount: number; faces: DisplacementSelectE2eFace[] }>(result);
      expect(data.addedCount).toBe(1);
      expect(data.faces).toEqual([
        { ...first, displaced: true },
        { ...neighbour, displaced: true },
      ]);
      expect(data.faces.some((face) => face.brushId === distant.brushId)).toBe(false);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
