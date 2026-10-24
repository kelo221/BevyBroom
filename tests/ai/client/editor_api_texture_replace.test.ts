import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import { findMcpTool } from '@/ai/server/registry_mcp_tool.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from './editor_api_test_host.js';
import { solidBrushToolsTestBoxAdd } from '../../tools/csg/solid/solid_brush_tools_test_helpers.js';

/** Editor API over two boxes in one model. */
interface TextureReplaceApiRig {
  readonly parts: EditorApiTestHostParts;
  readonly api: EditorApi;
  readonly brushes: SolidBrushInstance[];
}

/**
 * Builds an editor API over two separated boxes.
 *
 * @returns Test rig.
 */
function textureReplaceApiRigCreate(): TextureReplaceApiRig {
  const parts = editorApiTestHostCreate();
  const model = new SolidModel('TextureReplaceApi');
  parts.world.add(model.root);
  const edges = new THREE.Vector3(1, 1, 1);
  const brushes = [0, 3].map((x) => solidBrushToolsTestBoxAdd(model, edges, new THREE.Vector3(x, 0, 0)));
  return { parts, api: new EditorApi(parts.host), brushes };
}

/**
 * Paints one face of each brush with a material through set_face_material.
 *
 * @param rig Test rig.
 * @param textureId Material id.
 */
function firstFacesPaint(rig: TextureReplaceApiRig, textureId: string): void {
  for (const brush of rig.brushes) {
    expect(rig.api.invokeTool('set_face_material', { brushId: brush.id, faceIndices: [0], textureId }).ok).toBe(true);
  }
}

/** Unit tests for the replace_texture MCP tool. */
describe('EditorApi replace_texture', () => {
  it('is listed in the MCP catalog with an undo note', () => {
    expect(findMcpTool('replace_texture')?.description.toLowerCase()).toContain('undo');
  });

  it('replaces a material on every brush and reports the face count', () => {
    const rig = textureReplaceApiRigCreate();
    firstFacesPaint(rig, 'api-old');
    const result = rig.api.invokeTool('replace_texture', { findTextureId: 'api-old', replaceTextureId: 'api-new' });
    expect(result.ok, result.message).toBe(true);
    expect((result.data as { faceCount: number }).faceCount).toBe(rig.brushes.length);
    expect(rig.brushes.map((brush) => brush.getSurfaceTextureId(0))).toEqual(rig.brushes.map(() => 'api-new'));
  });

  it('limits the selection scope to the selected brush', () => {
    const rig = textureReplaceApiRigCreate();
    firstFacesPaint(rig, 'api-old');
    const [unselected, selected] = rig.brushes;
    if (!unselected || !selected?.mesh) {
      throw new Error('rig brush missing');
    }
    rig.parts.host.selectionManager.setSelection([selected.mesh]);
    rig.api.invokeTool('replace_texture', {
      findTextureId: 'api-old',
      replaceTextureId: 'api-new',
      scope: 'selection',
    });
    expect([unselected.getSurfaceTextureId(0), selected.getSurfaceTextureId(0)]).toEqual(['api-old', 'api-new']);
  });

  it('rejects a missing replacement or an unknown scope', () => {
    const rig = textureReplaceApiRigCreate();
    expect(rig.api.invokeTool('replace_texture', { findTextureId: 'api-old' }).ok).toBe(false);
    const badScope = { findTextureId: 'api-old', replaceTextureId: 'api-new', scope: 'visible' };
    expect(rig.api.invokeTool('replace_texture', badScope).ok).toBe(false);
  });
});
