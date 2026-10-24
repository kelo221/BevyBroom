import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { e2eRequiredConfigurationAssert, e2eWindowsShownRead } from '../preview_e2e_environment.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';

/**
 * End-to-end acceptance of the face UV MCP tools in the built desktop app: a
 * face is painted and its UV rows written, another face is rotated, and each
 * edit is one undo step. Skipped unless BROOM_E2E_DESKTOP_EXE names the app
 * launcher.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_MCP_PORT'] ?? '18925');
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;

/** One face row of a get_face_uv reply. */
interface FaceUvE2eRow {
  faceIndex: number;
  textureId: string;
  u: number[];
  v: number[];
  rotationDeg: number;
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

describe.skipIf(desktopExecutable === '')('desktop app face UV tools end to end', () => {
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
   * Creates a model holding one box brush.
   *
   * @returns Brush id.
   */
  async function brushCreate(): Promise<string> {
    const model = await client.toolCallExpectOk('create_solid_model', { name: 'FaceUvE2e' });
    const modelId = toolDataRead<{ modelId: string }>(model).modelId;
    const added = await client.toolCallExpectOk('add_box_brush', { modelId, size: 2, position: { x: 0, y: 1, z: 0 } });
    return toolDataRead<{ brushId: string }>(added).brushId;
  }

  /**
   * Reads one face row.
   *
   * @param brushId Brush id.
   * @param faceIndex Face index.
   * @returns Face row.
   */
  async function faceRowRead(brushId: string, faceIndex: number): Promise<FaceUvE2eRow> {
    const result = await client.toolCallExpectOk('get_face_uv', { brushId, faceIndices: [faceIndex] });
    const row = toolDataRead<{ faces: FaceUvE2eRow[] }>(result).faces[0];
    if (!row) {
      throw new Error(`face ${faceIndex} missing from get_face_uv`);
    }
    return row;
  }

  beforeAll(async () => {
    await appLaunch();
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await app.stop();
  });

  it(
    'paints, writes and rotates face textures with each edit undoable',
    async () => {
      const brushId = await brushCreate();
      const original = await faceRowRead(brushId, 0);
      await client.toolCallExpectOk('set_face_material', { brushId, faceIndices: [0], textureId: 'e2e-face-texture' });
      expect((await faceRowRead(brushId, 0)).textureId).toBe('e2e-face-texture');
      const u = [0.5, 0, 0, 0.25];
      const v = [0, 0, 0.5, 0.75];
      await client.toolCallExpectOk('set_face_uv', { brushId, faceIndices: [0], u, v });
      const written = await faceRowRead(brushId, 0);
      written.u.forEach((value, index) => expect(value).toBeCloseTo(u[index] ?? Number.NaN, 6));
      const degrees = 30;
      const unrotated = await faceRowRead(brushId, 1);
      await client.toolCallExpectOk('transform_face_uv', { brushId, faceIndices: [1], operation: 'rotate', degrees });
      const rotated = await faceRowRead(brushId, 1);
      expect((((rotated.rotationDeg - unrotated.rotationDeg) % 360) + 360) % 360).toBeCloseTo(degrees, 3);
      await client.toolCallExpectOk('undo');
      await client.toolCallExpectOk('undo');
      await client.toolCallExpectOk('undo');
      expect((await faceRowRead(brushId, 0)).textureId).toBe(original.textureId);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
