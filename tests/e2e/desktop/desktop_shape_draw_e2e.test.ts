import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { e2eRequiredConfigurationAssert, e2eWindowsShownRead } from '../preview_e2e_environment.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';

/**
 * End-to-end acceptance of the shape draw MCP tools in the built desktop app:
 * stairs and a hollow cylinder are created, validated and undone as one step
 * each, and a painted stairs face keeps its texture and world-space UVs when
 * the group is regenerated. Skipped unless BROOM_E2E_DESKTOP_EXE names the app
 * launcher.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_MCP_PORT'] ?? '18885');
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;

/** Plain vector of a tool reply. */
interface ShapeE2eVector {
  x: number;
  y: number;
  z: number;
}

/** Bounds of a tool reply. */
interface ShapeE2eBounds {
  min: ShapeE2eVector;
  max: ShapeE2eVector;
}

/** Brush rows of a get_solid_model reply. */
interface ShapeE2eBrushRow {
  brushId: string;
  parentGroupId: string | null;
  localBounds: ShapeE2eBounds | null;
  worldBounds: ShapeE2eBounds | null;
}

/** One face row of a get_face_uv reply. */
interface ShapeE2eFaceRow {
  faceIndex: number;
  textureId: string;
  normal: [number, number, number];
  u: number[];
  v: number[];
}

/** Texture painted on a stairs face before the regenerate. */
const SHAPE_E2E_CARRY_TEXTURE_ID = 'e2e-shape-carry';

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

/**
 * Picks the face pointing most along +Z, the lateral side of stairs running
 * along X.
 *
 * @param faces Face rows of one brush.
 * @returns Lateral face row.
 */
function faceRowLateralPick(faces: readonly ShapeE2eFaceRow[]): ShapeE2eFaceRow {
  const lateral = faces.reduce<ShapeE2eFaceRow | null>(
    (best, face) => (best === null || face.normal[2] > best.normal[2] ? face : best),
    null,
  );
  if (!lateral) {
    throw new Error('brush has no faces');
  }
  return lateral;
}

/**
 * Reads the brush-local to world translation of an unrotated, unscaled brush.
 *
 * @param brush Brush row with local and world bounds.
 * @returns World translation of the brush origin.
 */
function brushTranslationRead(brush: ShapeE2eBrushRow): ShapeE2eVector {
  if (!brush.localBounds || !brush.worldBounds) {
    throw new Error(`brush ${brush.brushId} has no bounds`);
  }
  const { localBounds, worldBounds } = brush;
  return {
    x: worldBounds.min.x - localBounds.min.x,
    y: worldBounds.min.y - localBounds.min.y,
    z: worldBounds.min.z - localBounds.min.z,
  };
}

/**
 * Returns the world point at the middle of a brush's +Z side.
 *
 * @param brush Brush row with world bounds.
 * @returns World sample point.
 */
function lateralSamplePointCreate(brush: ShapeE2eBrushRow): ShapeE2eVector {
  if (!brush.worldBounds) {
    throw new Error(`brush ${brush.brushId} has no world bounds`);
  }
  const { min, max } = brush.worldBounds;
  return { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: max.z };
}

/**
 * Returns a world point on the seam two neighbouring stair steps share on their
 * +Z side.
 *
 * @param left Step nearer the stairs start.
 * @param right Next step.
 * @returns World point on both lateral faces.
 */
function lateralSeamPointCreate(left: ShapeE2eBrushRow, right: ShapeE2eBrushRow): ShapeE2eVector {
  if (!left.worldBounds || !right.worldBounds) {
    throw new Error('step rows have no world bounds');
  }
  const sharedTop = Math.min(left.worldBounds.max.y, right.worldBounds.max.y);
  return { x: left.worldBounds.max.x, y: (left.worldBounds.min.y + sharedTop) / 2, z: left.worldBounds.max.z };
}

/**
 * Projects a world point through a face's brush-local UV rows.
 *
 * @param face Face row with u and v rows.
 * @param brush Brush row the face belongs to.
 * @param worldPoint World point on the face.
 * @returns UV pair at that point.
 */
function faceUvAtWorldPoint(
  face: ShapeE2eFaceRow,
  brush: ShapeE2eBrushRow,
  worldPoint: ShapeE2eVector,
): { u: number; v: number } {
  const translation = brushTranslationRead(brush);
  const local = [worldPoint.x - translation.x, worldPoint.y - translation.y, worldPoint.z - translation.z];
  const rowApply = (row: readonly number[]) =>
    local.reduce((sum, component, axis) => sum + component * (row[axis] ?? 0), row[3] ?? 0);
  return { u: rowApply(face.u), v: rowApply(face.v) };
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

  /**
   * Reads every face row of a brush.
   *
   * @param brushId Brush id.
   * @returns Face rows.
   */
  async function faceRowsRead(brushId: string): Promise<ShapeE2eFaceRow[]> {
    const result = await client.toolCallExpectOk('get_face_uv', { brushId });
    return toolDataRead<{ faces: ShapeE2eFaceRow[] }>(result).faces;
  }

  /**
   * Paints the lateral face of a brush with the carry texture and a rotated,
   * offset UV mapping.
   *
   * @param brushId Brush id.
   * @returns Face row after the edit.
   */
  async function lateralFacePaint(brushId: string): Promise<ShapeE2eFaceRow> {
    const faceIndices = [faceRowLateralPick(await faceRowsRead(brushId)).faceIndex];
    await client.toolCallExpectOk('set_face_material', { brushId, faceIndices, textureId: SHAPE_E2E_CARRY_TEXTURE_ID });
    await client.toolCallExpectOk('transform_face_uv', { brushId, faceIndices, operation: 'rotate', degrees: 30 });
    return faceRowLateralPick(await faceRowsRead(brushId));
  }

  /**
   * Finds one brush row of a model by id.
   *
   * @param modelId Solid model uuid.
   * @param brushId Brush id.
   * @returns Brush row.
   */
  async function modelBrushRead(modelId: string, brushId: string): Promise<ShapeE2eBrushRow> {
    const brush = (await modelBrushesRead(modelId)).find((row) => row.brushId === brushId);
    if (!brush) {
      throw new Error(`brush ${brushId} missing from model ${modelId}`);
    }
    return brush;
  }

  /**
   * Waits until the first piece of a regenerated group shows the carry texture
   * on its lateral face.
   *
   * @param brushIds Brush ids returned by regenerate_shape_brush.
   * @returns First piece id and its lateral face row.
   */
  function regeneratedLateralFaceWait(
    brushIds: readonly string[],
  ): Promise<{ brushId: string; face: ShapeE2eFaceRow }> {
    return desktopE2eWaitUntil(
      'the regenerated first step to carry the lateral texture',
      async () => {
        const brushId = brushIds[0];
        const face = brushId ? faceRowLateralPick(await faceRowsRead(brushId)) : null;
        return brushId && face?.textureId === SHAPE_E2E_CARRY_TEXTURE_ID ? { brushId, face } : null;
      },
      STEP_TIMEOUT_MILLISECONDS,
    );
  }

  /**
   * Asserts neighbouring stair steps show the same texture coordinates where
   * their lateral faces meet.
   *
   * @param steps Step brush rows in step order.
   */
  async function lateralSeamsContinuityExpect(steps: readonly ShapeE2eBrushRow[]): Promise<void> {
    expect(steps.length).toBeGreaterThan(1);
    for (let order = 0; order + 1 < steps.length; order++) {
      const left = steps[order];
      const right = steps[order + 1];
      if (!left || !right) {
        throw new Error('missing step row');
      }
      const seamPoint = lateralSeamPointCreate(left, right);
      const leftUv = faceUvAtWorldPoint(faceRowLateralPick(await faceRowsRead(left.brushId)), left, seamPoint);
      const rightUv = faceUvAtWorldPoint(faceRowLateralPick(await faceRowsRead(right.brushId)), right, seamPoint);
      expect(rightUv.u).toBeCloseTo(leftUv.u, 4);
      expect(rightUv.v).toBeCloseTo(leftUv.v, 4);
    }
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

  it(
    'keeps a painted stairs face texture and its world-space UVs through regenerate_shape_brush and undo',
    async () => {
      const modelId = await modelCreate('ShapeCarryE2e');
      const oldPieces = await shapeDraw(
        modelId,
        'stairs',
        { stepHeight: 0.5 },
        { x: 0, y: 0, z: 0 },
        { x: 4, y: 2, z: 1 },
      );
      const oldFirst = oldPieces[0];
      expect(oldFirst).toBeDefined();
      if (!oldFirst) return;
      const oldFace = await lateralFacePaint(oldFirst.brushId);
      const modelBrushCountBefore = (await modelBrushesRead(modelId)).length;
      const regenerated = await client.toolCallExpectOk('regenerate_shape_brush', {
        nodeId: oldFirst.brushId,
        params: { stepHeight: 0.25 },
      });
      const brushIds = toolDataRead<{ brushIds: string[] }>(regenerated).brushIds;
      expect(brushIds.length).toBeGreaterThan(oldPieces.length);
      expect(brushIds).not.toContain(oldFirst.brushId);
      const carried = await regeneratedLateralFaceWait(brushIds);
      const newFirst = await modelBrushRead(modelId, carried.brushId);
      const samplePoint = lateralSamplePointCreate(newFirst);
      const oldUv = faceUvAtWorldPoint(oldFace, oldFirst, samplePoint);
      const newUv = faceUvAtWorldPoint(carried.face, newFirst, samplePoint);
      expect(newUv.u).toBeCloseTo(oldUv.u, 4);
      expect(newUv.v).toBeCloseTo(oldUv.v, 4);
      await client.toolCallExpectOk('undo');
      expect(await modelBrushesRead(modelId)).toHaveLength(modelBrushCountBefore);
      expect(faceRowLateralPick(await faceRowsRead(oldFirst.brushId)).textureId).toBe(SHAPE_E2E_CARRY_TEXTURE_ID);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'lines up the default stairs texture across every step seam after drawing and after regenerating',
    async () => {
      const modelId = await modelCreate('ShapeSeamE2e');
      const drawn = await shapeDraw(
        modelId,
        'stairs',
        { stepHeight: 0.25 },
        { x: 0, y: 0, z: 0 },
        { x: 4, y: 2, z: 1 },
      );
      await lateralSeamsContinuityExpect(drawn);
      const firstBrushId = drawn[0]?.brushId ?? '';
      const regenerated = await client.toolCallExpectOk('regenerate_shape_brush', {
        nodeId: firstBrushId,
        params: { stepHeight: 0.5 },
      });
      const brushIds = toolDataRead<{ brushIds: string[] }>(regenerated).brushIds;
      const regeneratedRows = await Promise.all(brushIds.map((brushId) => modelBrushRead(modelId, brushId)));
      await lateralSeamsContinuityExpect(regeneratedRows);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
