import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import type { EditorApiFaceUvRow } from '@/ai/client/editor_api_face_uv.js';
import { findMcpTool } from '@/ai/server/registry_mcp_tool.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { solidFaceUvOperationContextBuild } from '@/texture/commands/command_texture_solid_face_uv_operation.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';
import { solidBrushToolsTestBoxAdd } from '../../tools/csg/solid/solid_brush_tools_test_helpers.js';

/**
 * Builds an editor API over one box brush.
 *
 * @returns API, model and brush.
 */
function faceUvApiRigCreate(): { api: EditorApi; model: SolidModel; brush: SolidBrushInstance } {
  const parts = editorApiTestHostCreate();
  const model = new SolidModel('FaceUvApi');
  parts.world.add(model.root);
  const brush = solidBrushToolsTestBoxAdd(model, new THREE.Vector3(4, 2, 3), new THREE.Vector3(2, 1, 0));
  return { api: new EditorApi(parts.host), model, brush };
}

/**
 * Reads the face rows of a brush through get_face_uv.
 *
 * @param api Editor API.
 * @param brushId Brush id.
 * @param faceIndices Optional faces.
 * @returns Face rows.
 */
function faceUvApiRowsRead(api: EditorApi, brushId: string, faceIndices?: number[]): EditorApiFaceUvRow[] {
  const result = api.invokeTool('get_face_uv', faceIndices ? { brushId, faceIndices } : { brushId });
  expect(result.ok, result.message).toBe(true);
  return (result.data as { faces: EditorApiFaceUvRow[] }).faces;
}

/**
 * Returns the counter-clockwise angle from one rotation to another in [0, 360).
 *
 * @param fromDegrees Starting rotation.
 * @param toDegrees Final rotation.
 * @returns Wrapped difference in degrees.
 */
function faceUvApiAngleDelta(fromDegrees: number, toDegrees: number): number {
  return (((toDegrees - fromDegrees) % 360) + 360) % 360;
}

/** Unit tests for the face UV MCP tools. */
describe('EditorApi face UV tools', () => {
  it('lists the face UV tools in the MCP catalog', () => {
    for (const name of ['get_face_uv', 'set_face_material', 'set_face_uv', 'transform_face_uv']) {
      expect(findMcpTool(name)).toBeDefined();
    }
  });

  it('reads one row per brush face with the face normal', () => {
    const { api, brush } = faceUvApiRigCreate();
    const rows = faceUvApiRowsRead(api, brush.id);
    expect(rows).toHaveLength(brush.brush.faces.length);
    rows.forEach((row) => {
      const normal = brush.faceNormalLocal(row.faceIndex);
      expect(new THREE.Vector3(...row.normal).distanceTo(normal)).toBeLessThan(1e-6);
    });
  });

  it('paints chosen faces and leaves the others unchanged, undoable in one step', () => {
    const { api, brush } = faceUvApiRigCreate();
    const before = faceUvApiRowsRead(api, brush.id).map((row) => row.textureId);
    const result = api.invokeTool('set_face_material', { brushId: brush.id, faceIndices: [1], textureId: 'api-wall' });
    expect((result.data as { editedFaceCount: number }).editedFaceCount).toBe(1);
    const after = faceUvApiRowsRead(api, brush.id).map((row) => row.textureId);
    expect(after[1]).toBe('api-wall');
    expect(after.filter((_id, index) => index !== 1)).toEqual(before.filter((_id, index) => index !== 1));
    api.invokeTool('undo');
    expect(faceUvApiRowsRead(api, brush.id).map((row) => row.textureId)).toEqual(before);
  });

  it('writes UV rows that get_face_uv reads back', () => {
    const { api, brush } = faceUvApiRigCreate();
    const u = [0.5, 0, 0, 0.125];
    const v = [0, 0, 0.25, 0.5];
    expect(api.invokeTool('set_face_uv', { brushId: brush.id, faceIndices: [0], u, v }).ok).toBe(true);
    const row = faceUvApiRowsRead(api, brush.id, [0])[0];
    row?.u.forEach((value, index) => expect(value).toBeCloseTo(u[index] ?? Number.NaN, 6));
    row?.v.forEach((value, index) => expect(value).toBeCloseTo(v[index] ?? Number.NaN, 6));
  });

  it('fits the texture across a face with transform_face_uv', () => {
    const { api, brush } = faceUvApiRigCreate();
    const repeatCount = 2;
    const result = api.invokeTool('transform_face_uv', {
      brushId: brush.id,
      operation: 'fit',
      axis: 'both',
      repeatCount,
    });
    expect(result.ok, result.message).toBe(true);
    const context = solidFaceUvOperationContextBuild(brush, 0);
    if (!context) throw new Error('face context missing');
    const bounds = context.uvBounds(brush.getFaceSurface(0).uv);
    expect(bounds.maxU - bounds.minU).toBeCloseTo(repeatCount, 4);
  });

  it('turns the reported texture rotation by the rotate degrees', () => {
    const { api, brush } = faceUvApiRigCreate();
    const degrees = 30;
    for (const row of faceUvApiRowsRead(api, brush.id)) {
      api.invokeTool('transform_face_uv', {
        brushId: brush.id,
        faceIndices: [row.faceIndex],
        operation: 'rotate',
        degrees,
      });
      const rotated = faceUvApiRowsRead(api, brush.id, [row.faceIndex])[0];
      expect(faceUvApiAngleDelta(row.rotationDeg, rotated?.rotationDeg ?? Number.NaN)).toBeCloseTo(degrees, 3);
    }
  });

  it('rejects unknown operations, missing brushes and out-of-range faces', () => {
    const { api, brush } = faceUvApiRigCreate();
    expect(api.invokeTool('transform_face_uv', { brushId: brush.id, operation: 'melt' }).ok).toBe(false);
    expect(api.invokeTool('transform_face_uv', { brushId: brush.id, operation: 'rotate' }).ok).toBe(false);
    expect(api.invokeTool('get_face_uv', { brushId: 'missing' }).ok).toBe(false);
    const faceCount = brush.brush.faces.length;
    expect(api.invokeTool('get_face_uv', { brushId: brush.id, faceIndices: [faceCount] }).ok).toBe(false);
  });
});
