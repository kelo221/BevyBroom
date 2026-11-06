import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import { findMcpTool } from '@/ai/server/registry_mcp_tool.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { DisplacementFaceTools } from '@/displacement/controller/displacement_face_tools.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { findFirstTriangleForBrushSurface } from '@/selection/face/solid_triangle_source_index.js';
import { EditorToolId } from '@/types/editor_tool_id.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';
import { solidBrushToolsTestBoxAdd } from '../../tools/csg/solid/solid_brush_tools_test_helpers.js';
import { displacementTestFaceFacing } from '../../displacement/displacement_test_rig.js';

/** Editor API over one box brush with live face tools. */
interface FaceEditApiRig {
  api: EditorApi;
  model: SolidModel;
  faceController: ControllerFaceExtrusion;
  faceTools: DisplacementFaceTools;
  activeTool: { id: string | null };
}

/**
 * Builds an editor API over a world with one box brush, face tools installed as
 * the shared displacement actions and an active tool the test sets.
 *
 * @returns API, model, face controller, face tools and the active tool holder.
 */
function faceEditApiRigCreate(): FaceEditApiRig {
  const activeTool: { id: string | null } = { id: EditorToolId.OBJECT };
  const parts = editorApiTestHostCreate({ activeToolRead: () => activeTool.id });
  const model = new SolidModel('FaceEditApi');
  parts.world.add(model.root);
  solidBrushToolsTestBoxAdd(model, new THREE.Vector3(2, 3, 4), new THREE.Vector3(3, 1.5, -1));
  model.rebuild(true);
  const faceController = new ControllerFaceExtrusion(
    new THREE.Scene(),
    parts.host.commandStack,
    new GridSnap(false, 1),
    parts.world,
  );
  const faceTools = new DisplacementFaceTools({
    commandStack: parts.host.commandStack,
    faceSelection: faceController,
    isCtrlDown: () => false,
    isShiftDown: () => false,
    afterDab: () => undefined,
  });
  return { api: new EditorApi(parts.host), model, faceController, faceTools, activeTool };
}

/** Unit tests for the get_face_edit_state MCP tool. */
describe('EditorApi get_face_edit_state', () => {
  afterEach(() => {
    getStateFaceEditSession().reset();
  });

  it('lists get_face_edit_state in the MCP catalog', () => {
    expect(findMcpTool('get_face_edit_state')).toBeDefined();
  });

  it('reports the active tool, the Face Edit Sheet and the selected brush face', () => {
    const rig = faceEditApiRigCreate();
    const brush = rig.model.getBrushes()[0];
    if (!brush) throw new Error('brush missing');
    const before = rig.api.invokeTool('get_face_edit_state');
    expect(before.ok, before.message).toBe(true);
    expect(before.data).toEqual({
      activeTool: EditorToolId.OBJECT,
      faceEditSheetOpen: false,
      faceEditSheetTab: 'material',
      faces: [],
    });
    const faceIndex = displacementTestFaceFacing(brush, new THREE.Vector3(0, 0, 1));
    const resultMesh = rig.model.getResultMesh();
    rig.faceController.selectFace(resultMesh, findFirstTriangleForBrushSurface(resultMesh, brush.id, faceIndex), false);
    getStateFaceEditSession().sheetOpenWrite(true);
    rig.activeTool.id = EditorToolId.FACE;
    expect(rig.api.invokeTool('get_face_edit_state').data).toEqual({
      activeTool: EditorToolId.FACE,
      faceEditSheetOpen: true,
      faceEditSheetTab: 'material',
      faces: [{ brushId: brush.id, faceIndex, displaced: false }],
    });
    rig.faceTools.dispose();
  });

  it('reports no active tool and no faces when the host has neither', () => {
    const api = new EditorApi(editorApiTestHostCreate().host);
    expect(api.invokeTool('get_face_edit_state').data).toMatchObject({ activeTool: null, faces: [] });
  });
});
