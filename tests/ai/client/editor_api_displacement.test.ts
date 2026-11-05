import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import { findMcpTool } from '@/ai/server/registry_mcp_tool.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { displacementVertexCount } from '@/displacement/model/displacement_face_surface.js';
import { displacementSurfaceMeshesUnder } from '@/displacement/mesh/displacement_surface_mesh_keys.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';
import { solidBrushToolsTestBoxAdd } from '../../tools/csg/solid/solid_brush_tools_test_helpers.js';

/**
 * Builds an editor API over one box brush.
 *
 * @returns API, model and brush.
 */
function displacementApiRigCreate(): { api: EditorApi; model: SolidModel; brush: SolidBrushInstance } {
  const parts = editorApiTestHostCreate();
  const model = new SolidModel('DisplacementApi');
  parts.world.add(model.root);
  const brush = solidBrushToolsTestBoxAdd(model, new THREE.Vector3(3, 2, 3), new THREE.Vector3(-1, 1, 2));
  model.rebuild(true);
  return { api: new EditorApi(parts.host), model, brush };
}

/** Unit tests for the set_face_displacement MCP tool. */
describe('EditorApi displacement tool', () => {
  it('lists set_face_displacement in the MCP catalog', () => {
    expect(findMcpTool('set_face_displacement')).toBeDefined();
  });

  it('creates, edits and removes a face displacement, each undoable', () => {
    const { api, model, brush } = displacementApiRigCreate();
    const created = api.invokeTool('set_face_displacement', {
      brushId: brush.id,
      faceIndex: 1,
      action: 'create',
      power: 2,
    });
    expect(created.ok, created.message).toBe(true);
    expect(created.data).toMatchObject({ displaced: true, power: 2, vertexCount: displacementVertexCount(2) });
    expect(displacementSurfaceMeshesUnder(model.root)).toHaveLength(1);
    const offsets = Array.from({ length: displacementVertexCount(2) }, (_unused, index) => index / 100);
    const edited = api.invokeTool('set_face_displacement', {
      brushId: brush.id,
      faceIndex: 1,
      action: 'set',
      elevation: 0.5,
      offsets,
    });
    expect(edited.ok, edited.message).toBe(true);
    expect(brush.faceDisplacementRead(1)?.offsets).toEqual(offsets);
    expect(brush.faceDisplacementRead(1)?.elevation).toBe(0.5);
    api.invokeTool('undo');
    expect(brush.faceDisplacementRead(1)?.elevation).toBe(0);
    expect(api.invokeTool('set_face_displacement', { brushId: brush.id, faceIndex: 1, action: 'destroy' }).ok).toBe(
      true,
    );
    expect(brush.faceDisplacementRead(1)).toBeUndefined();
    expect(displacementSurfaceMeshesUnder(model.root)).toHaveLength(0);
  });

  it('rejects bad offsets, missing displacements, bad faces and subtractive brushes', () => {
    const { api, model, brush } = displacementApiRigCreate();
    const faceCount = brush.brush.faces.length;
    expect(api.invokeTool('set_face_displacement', { brushId: brush.id, faceIndex: 0, action: 'set' }).ok).toBe(false);
    expect(
      api.invokeTool('set_face_displacement', { brushId: brush.id, faceIndex: faceCount, action: 'create' }).ok,
    ).toBe(false);
    expect(
      api.invokeTool('set_face_displacement', { brushId: brush.id, faceIndex: 0, action: 'create', offsets: [1, 2] })
        .ok,
    ).toBe(false);
    expect(api.invokeTool('set_face_displacement', { brushId: brush.id, faceIndex: 0, action: 'melt' }).ok).toBe(false);
    const carve = model.addBoxBrush(1, SolidOperation.Subtractive, model.root, false);
    expect(api.invokeTool('set_face_displacement', { brushId: carve.id, faceIndex: 0, action: 'create' }).ok).toBe(
      false,
    );
    expect(brush.faceDisplacementIndices()).toEqual([]);
  });
});
