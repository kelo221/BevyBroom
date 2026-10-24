import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { e2eRequiredConfigurationAssert, e2eWindowsShownRead } from '../preview_e2e_environment.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';

/**
 * End-to-end acceptance of the brush editing MCP tools in the built desktop
 * app: hollow, flip, shear, vertex snap and convex merge each edit real brushes
 * as one undo step. Skipped unless BROOM_E2E_DESKTOP_EXE names the app
 * launcher.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_MCP_PORT'] ?? '18905');
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;
const BOUNDS_TOLERANCE = 1e-3;

/** World vector of an MCP reply. */
interface BrushToolsE2eVector {
  x: number;
  y: number;
  z: number;
}

/** World bounds of an MCP reply. */
interface BrushToolsE2eBounds {
  min: BrushToolsE2eVector;
  max: BrushToolsE2eVector;
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

describe.skipIf(desktopExecutable === '')('desktop app brush tools end to end', () => {
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
   * Adds a cube brush and returns its id.
   *
   * @param modelId Solid model uuid.
   * @param size Cube edge length.
   * @param position Cube center.
   * @returns Brush id.
   */
  async function cubeAdd(modelId: string, size: number, position: BrushToolsE2eVector): Promise<string> {
    const result = await client.toolCallExpectOk('add_box_brush', { modelId, size, position });
    return toolDataRead<{ brushId: string }>(result).brushId;
  }

  /**
   * Returns the brush count of a model.
   *
   * @param modelId Solid model uuid.
   * @returns Brush count.
   */
  async function brushCountRead(modelId: string): Promise<number> {
    const result = await client.toolCallExpectOk('get_solid_model', { modelId });
    return toolDataRead<{ brushes: unknown[] }>(result).brushes.length;
  }

  /**
   * Returns the combined world bounds of brushes.
   *
   * @param brushIds Brush ids.
   * @returns Union of their world bounds.
   */
  async function boundsRead(brushIds: readonly string[]): Promise<BrushToolsE2eBounds> {
    const boxes: BrushToolsE2eBounds[] = [];
    for (const brushId of brushIds) {
      const result = await client.toolCallExpectOk('get_brush', { brushId });
      boxes.push(toolDataRead<{ worldBounds: BrushToolsE2eBounds }>(result).worldBounds);
    }
    return boundsUnion(boxes);
  }

  /**
   * Returns the union of bounds.
   *
   * @param boxes Bounds to combine.
   * @returns Combined bounds.
   */
  function boundsUnion(boxes: readonly BrushToolsE2eBounds[]): BrushToolsE2eBounds {
    const axes = ['x', 'y', 'z'] as const;
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (const box of boxes) {
      axes.forEach((axis) => {
        min[axis] = Math.min(min[axis], box.min[axis]);
        max[axis] = Math.max(max[axis], box.max[axis]);
      });
    }
    return { min, max };
  }

  /**
   * Returns the editor's undo count.
   *
   * @returns Number of undo entries.
   */
  async function undoCountRead(): Promise<number> {
    const result = await client.toolCallExpectOk('get_editor_context');
    return toolDataRead<{ undoCount: number }>(result).undoCount;
  }

  /**
   * Runs a tool, checks it added exactly one undo entry and returns its result.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result.
   */
  async function toolCallOneUndoStep(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    const undoCountBefore = await undoCountRead();
    const result = await client.toolCallExpectOk(name, args);
    expect(await undoCountRead()).toBe(undoCountBefore + 1);
    return result;
  }

  beforeAll(async () => {
    await appLaunch();
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await app.stop();
  });

  it(
    'hollows a cube into valid walls and undoes it as one step',
    async () => {
      const modelId = await modelCreate('BrushToolsHollowE2e');
      const cubeId = await cubeAdd(modelId, 2, { x: 0, y: 1, z: 0 });
      const countBefore = await brushCountRead(modelId);
      const cubeBounds = await boundsRead([cubeId]);
      const result = await toolCallOneUndoStep('hollow_brushes', { brushIds: [cubeId], thickness: 0.25 });
      const wallIds = toolDataRead<{ wallBrushIds: string[] }>(result).wallBrushIds;
      expect(wallIds.length).toBeGreaterThan(0);
      for (const wallId of wallIds) {
        await client.toolCallExpectOk('validate_brush', { brushId: wallId });
      }
      const wallBounds = await boundsRead(wallIds);
      expect(wallBounds.min.y).toBeCloseTo(cubeBounds.min.y, 3);
      expect(wallBounds.max.y).toBeCloseTo(cubeBounds.max.y, 3);
      await client.toolCallExpectOk('undo');
      expect(await brushCountRead(modelId)).toBe(countBefore);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'flips, shears and snaps brushes so their world bounds follow each edit',
    async () => {
      const modelId = await modelCreate('BrushToolsTransformE2e');
      const brushIds = [
        await cubeAdd(modelId, 2, { x: 0, y: 1, z: 0 }),
        await cubeAdd(modelId, 1, { x: 4, y: 0.5, z: 0 }),
      ];
      const before = await boundsRead(brushIds);
      const flipped = await toolCallOneUndoStep('flip_brushes', { brushIds, axis: 'x' });
      const center = toolDataRead<{ center: number }>(flipped).center;
      expect((await boundsRead(brushIds)).min.x).toBeCloseTo(2 * center - before.max.x, 3);
      const offset = 1;
      const beforeShear = await boundsRead(brushIds);
      await toolCallOneUndoStep('shear_brushes', { brushIds, axis: 'y', along: 'z', offset });
      expect((await boundsRead(brushIds)).max.z).toBeCloseTo(beforeShear.max.z + offset, 3);
      const offGridId = await cubeAdd(modelId, 1.4, { x: 8.3, y: 0.2, z: 0.1 });
      await toolCallOneUndoStep('snap_brush_vertices', { brushIds: [offGridId], step: 'integer' });
      const snapped = await boundsRead([offGridId]);
      for (const value of [snapped.min.x, snapped.min.y, snapped.min.z, snapped.max.x, snapped.max.y, snapped.max.z]) {
        expect(Math.abs(value - Math.round(value))).toBeLessThan(BOUNDS_TOLERANCE);
      }
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'merges two cubes into one brush spanning both',
    async () => {
      const modelId = await modelCreate('BrushToolsMergeE2e');
      const brushIds = [
        await cubeAdd(modelId, 2, { x: 0, y: 1, z: 0 }),
        await cubeAdd(modelId, 1, { x: 3, y: 2, z: 1 }),
      ];
      const countBefore = await brushCountRead(modelId);
      const expected = await boundsRead(brushIds);
      const result = await toolCallOneUndoStep('convex_merge_brushes', { brushIds });
      const mergedId = toolDataRead<{ brushId: string }>(result).brushId;
      await client.toolCallExpectOk('validate_brush', { brushId: mergedId });
      const merged = await boundsRead([mergedId]);
      expect(merged.min.x).toBeCloseTo(expected.min.x, 3);
      expect(merged.max.y).toBeCloseTo(expected.max.y, 3);
      expect(await brushCountRead(modelId)).toBe(countBefore - 1);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
