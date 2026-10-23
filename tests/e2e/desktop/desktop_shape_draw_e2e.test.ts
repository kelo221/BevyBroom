import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { e2eRequiredConfigurationAssert, e2eWindowsShownRead } from '../preview_e2e_environment.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';

/**
 * End-to-end acceptance of the shape draw MCP tool in the built desktop app:
 * stairs and a hollow cylinder are created, validated and undone as one step
 * each. Skipped unless BROOM_E2E_DESKTOP_EXE names the app launcher.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_MCP_PORT'] ?? '18885');
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;

/** Brush rows of a get_solid_model reply. */
interface ShapeE2eBrushRow {
  brushId: string;
  parentGroupId: string | null;
}

/** Data of a get_solid_model reply. */
interface ShapeE2eSolidModel {
  brushes: ShapeE2eBrushRow[];
}

/** Data of a get_editor_context reply. */
interface ShapeE2eEditorContext {
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

describe.skipIf(desktopExecutable === '')('desktop app shape draw end to end', () => {
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
   * Returns the brush rows of a solid model.
   *
   * @param modelId Solid model uuid.
   * @returns Brush rows in evaluation order.
   */
  async function modelBrushesRead(modelId: string): Promise<ShapeE2eBrushRow[]> {
    const result = await client.toolCallExpectOk('get_solid_model', { modelId });
    return toolDataRead<ShapeE2eSolidModel>(result).brushes;
  }

  /**
   * Returns the editor's undo count.
   *
   * @returns Number of undo entries.
   */
  async function undoCountRead(): Promise<number> {
    const result = await client.toolCallExpectOk('get_editor_context');
    return toolDataRead<ShapeE2eEditorContext>(result).undoCount;
  }

  /**
   * Creates a fresh named solid model and returns its id.
   *
   * @param name Model display name.
   * @returns Solid model uuid.
   */
  async function modelCreate(name: string): Promise<string> {
    const result = await client.toolCallExpectOk('create_solid_model', { name });
    return toolDataRead<{ modelId: string }>(result).modelId;
  }

  /**
   * Validates every brush of a model.
   *
   * @param brushes Brush rows to validate.
   */
  async function brushesValidate(brushes: ShapeE2eBrushRow[]): Promise<void> {
    for (const brush of brushes) {
      await client.toolCallExpectOk('validate_brush', { brushId: brush.brushId });
    }
  }

  /**
   * Draws one shape and returns the brushes it added.
   *
   * @param modelId Solid model uuid.
   * @param shapeId Shape identifier.
   * @param params Shape parameters.
   * @param min Bounds minimum corner.
   * @param max Bounds maximum corner.
   * @returns Brush rows the shape added.
   */
  async function shapeDraw(
    modelId: string,
    shapeId: string,
    params: Record<string, number | string>,
    min: { x: number; y: number; z: number },
    max: { x: number; y: number; z: number },
  ): Promise<ShapeE2eBrushRow[]> {
    const before = await modelBrushesRead(modelId);
    await client.toolCallExpectOk('create_shape_brush', { shapeId, modelId, min, max, params });
    const after = await modelBrushesRead(modelId);
    return after.slice(before.length);
  }

  /**
   * Asserts a shape added the expected number of grouped, valid brushes and
   * that one undo removes them all again.
   *
   * @param modelId Solid model uuid.
   * @param shapeId Shape identifier.
   * @param params Shape parameters.
   * @param min Bounds minimum corner.
   * @param max Bounds maximum corner.
   * @param expectedPieceCount Expected number of created brushes.
   */
  async function shapeExpectUndoable(
    modelId: string,
    shapeId: string,
    params: Record<string, number | string>,
    min: { x: number; y: number; z: number },
    max: { x: number; y: number; z: number },
    expectedPieceCount: number,
  ): Promise<void> {
    const before = await modelBrushesRead(modelId);
    const undoCountBefore = await undoCountRead();
    const created = await shapeDraw(modelId, shapeId, params, min, max);
    expect(created).toHaveLength(expectedPieceCount);
    await brushesValidate(created);
    expect(created.every((brush) => brush.parentGroupId !== null)).toBe(true);
    expect(await undoCountRead()).toBe(undoCountBefore + 1);
    await client.toolCallExpectOk('undo');
    expect(await modelBrushesRead(modelId)).toHaveLength(before.length);
  }

  beforeAll(async () => {
    await appLaunch();
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await app.stop();
  });

  it(
    'creates stairs and a hollow cylinder through create_shape_brush and undoes each as one step',
    async () => {
      const modelId = await modelCreate('ShapeE2e');
      await shapeExpectUndoable(modelId, 'stairs', { stepHeight: 0.5 }, { x: 0, y: 0, z: 0 }, { x: 4, y: 2, z: 1 }, 4);
      await shapeExpectUndoable(
        modelId,
        'cylinder',
        { sides: 6, hollow: 'on', wallThickness: 0.2 },
        { x: -1, y: 0, z: -1 },
        { x: 1, y: 2, z: 1 },
        6,
      );
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
