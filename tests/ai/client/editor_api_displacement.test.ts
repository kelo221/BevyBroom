import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import { findMcpTool } from '@/ai/server/registry_mcp_tool.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { displacementVertexCount } from '@/displacement/model/displacement_face_surface.js';
import { displacementSurfaceMeshesUnder } from '@/displacement/mesh/displacement_surface_mesh_keys.js';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { DisplacementFaceTools } from '@/displacement/controller/displacement_face_tools.js';
import { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';
import { solidBrushToolsTestBoxAdd } from '../../tools/csg/solid/solid_brush_tools_test_helpers.js';
import { displacementTestFaceFacing } from '../../displacement/displacement_test_rig.js';

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

/**
 * API over a world with live face tools installed as the shared displacement
 * actions.
 */
interface AdjacentApiRig {
  api: EditorApi;
  model: SolidModel;
  faceController: ControllerFaceExtrusion;
  faceTools: DisplacementFaceTools;
}

/**
 * Builds an editor API over an empty solid model with face tools installed.
 *
 * @returns API, model, face controller and face tools.
 */
function adjacentApiRigCreate(): AdjacentApiRig {
  const parts = editorApiTestHostCreate();
  const model = new SolidModel('DisplacementAdjacentApi');
  parts.world.add(model.root);
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
  return { api: new EditorApi(parts.host), model, faceController, faceTools };
}

/**
 * Adds three boxes along X: two touching and one far away.
 *
 * @param model Model receiving the boxes.
 * @returns Selected, touching neighbour and distant brush.
 */
function adjacentApiBoxRowAdd(model: SolidModel): [SolidBrushInstance, SolidBrushInstance, SolidBrushInstance] {
  const edges = new THREE.Vector3(2, 1, 2);
  const origin = new THREE.Vector3(-4, 0.5, 1);
  const step = new THREE.Vector3(edges.x, 0, 0);
  const brushes: [SolidBrushInstance, SolidBrushInstance, SolidBrushInstance] = [
    solidBrushToolsTestBoxAdd(model, edges, origin),
    solidBrushToolsTestBoxAdd(model, edges, origin.clone().add(step)),
    solidBrushToolsTestBoxAdd(model, edges, origin.clone().addScaledVector(step, 6)),
  ];
  model.rebuild(true);
  return brushes;
}

/**
 * Builds the edit target of one face of a brush.
 *
 * @param brush Brush owning the face; it must belong to a solid model.
 * @param surfaceIndex Face index.
 * @returns Face target.
 */
function displacementApiFaceTarget(brush: SolidBrushInstance, surfaceIndex: number): SolidFaceTextureTarget {
  const model = brush.mesh ? SolidModel.fromObject(brush.mesh) : null;
  if (!model) throw new Error('brush has no solid model');
  return { model, brushId: brush.id, surfaceIndex };
}

/**
 * Returns the largest distance between displaced border vertices of two faces
 * whose flat positions coincide.
 *
 * @param targets The two displaced faces.
 * @returns Largest gap in meters; fails when the faces share no border point.
 */
function displacementApiSharedEdgeGapRead(targets: readonly SolidFaceTextureTarget[]): number {
  const [first, second] = targets.map((target) => DisplacementSculptFace.fromTarget(target));
  if (!first || !second) throw new Error('faces have no displacement');
  const secondPositions = second.placement.displacedPositions(second.displacement);
  const gaps = first.placement.displacedPositions(first.displacement).flatMap((position, vertexIndex) => {
    const base = first.placement.basePositions[vertexIndex];
    const partnerIndex = second.placement.basePositions.findIndex((other) => base && other.distanceTo(base) < 1e-4);
    const partner = secondPositions[partnerIndex];
    return partner ? [position.distanceTo(partner)] : [];
  });
  expect(gaps.length).toBeGreaterThan(0);
  return Math.max(...gaps);
}

/** Unit tests for the displacement MCP tools. */
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

  it('sets collision flags partially, keeps unnamed flags and reports them', () => {
    const { api, brush } = displacementApiRigCreate();
    const created = api.invokeTool('set_face_displacement', {
      brushId: brush.id,
      faceIndex: 2,
      action: 'create',
      flags: { noHullCollision: true },
    });
    expect(created.ok, created.message).toBe(true);
    expect(created.data).toMatchObject({
      flags: { noPhysicsCollision: false, noHullCollision: true, noRayCollision: false, seals: false },
    });
    const edited = api.invokeTool('set_face_displacement', {
      brushId: brush.id,
      faceIndex: 2,
      action: 'set',
      flags: { seals: true },
    });
    expect(edited.ok, edited.message).toBe(true);
    expect(brush.faceDisplacementRead(2)?.flags).toEqual({
      noPhysicsCollision: false,
      noHullCollision: true,
      noRayCollision: false,
      seals: true,
    });
    const rejected = api.invokeTool('set_face_displacement', {
      brushId: brush.id,
      faceIndex: 2,
      action: 'set',
      flags: { seals: 'on' },
    });
    expect(rejected.ok).toBe(false);
    expect(brush.faceDisplacementRead(2)?.flags.seals).toBe(true);
    api.invokeTool('undo');
    expect(brush.faceDisplacementRead(2)?.flags.seals).toBe(false);
  });

  it('lists select_adjacent_displacements in the MCP catalog', () => {
    expect(findMcpTool('select_adjacent_displacements')).toBeDefined();
  });

  it('selects the displaced faces adjacent to the named faces and returns the face selection', () => {
    const { api, faceTools, faceController, model } = adjacentApiRigCreate();
    const [selected, neighbour, distant] = adjacentApiBoxRowAdd(model);
    const topFace = (brush: SolidBrushInstance): number =>
      displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0));
    [selected, neighbour, distant].forEach((brush) => {
      const created = api.invokeTool('set_face_displacement', {
        brushId: brush.id,
        faceIndex: topFace(brush),
        action: 'create',
      });
      expect(created.ok, created.message).toBe(true);
    });
    const result = api.invokeTool('select_adjacent_displacements', {
      faces: [{ brushId: selected.id, faceIndex: topFace(selected) }],
    });
    expect(result.ok, result.message).toBe(true);
    expect(result.data).toEqual({
      addedCount: 1,
      faces: [
        { brushId: selected.id, faceIndex: topFace(selected), displaced: true },
        { brushId: neighbour.id, faceIndex: topFace(neighbour), displaced: true },
      ],
    });
    expect(faceController.getSelectedFaceCount()).toBe(2);
    const again = api.invokeTool('select_adjacent_displacements', {});
    expect(again.ok).toBe(true);
    expect(again.data).toMatchObject({ addedCount: 0 });
    expect(api.invokeTool('select_adjacent_displacements', { faces: [{ brushId: 'missing', faceIndex: 0 }] }).ok).toBe(
      false,
    );
    faceTools.dispose();
    expect(api.invokeTool('select_adjacent_displacements', {}).ok).toBe(false);
  });

  it('lists sew_displacements in the MCP catalog', () => {
    expect(findMcpTool('sew_displacements')).toBeDefined();
  });

  it('sews the shared edge of perpendicular displaced faces exactly as one undo step', () => {
    const { api, brush } = displacementApiRigCreate();
    const faces = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)].map((direction) => ({
      brushId: brush.id,
      faceIndex: displacementTestFaceFacing(brush, direction),
    }));
    faces.forEach((face, faceOrder) => {
      const offsets = Array.from({ length: displacementVertexCount(2) }, (_unused, index) =>
        Math.sin(index * 1.3 + faceOrder),
      );
      const created = api.invokeTool('set_face_displacement', { ...face, action: 'create', power: 2, offsets });
      expect(created.ok, created.message).toBe(true);
    });
    const targets = faces.map((face) => displacementApiFaceTarget(brush, face.faceIndex));
    expect(displacementApiSharedEdgeGapRead(targets)).toBeGreaterThan(1e-3);
    const sewn = api.invokeTool('sew_displacements', { faces });
    expect(sewn.ok, sewn.message).toBe(true);
    expect(sewn.data).toEqual({ sewnCount: 2 });
    expect(displacementApiSharedEdgeGapRead(targets)).toBeLessThan(1e-5);
    faces.forEach((face) => expect(brush.faceDisplacementRead(face.faceIndex)?.seamOffsets).toBeDefined());
    const resampled = api.invokeTool('set_face_displacement', { ...faces[0], action: 'set', power: 3 });
    expect(resampled.ok, resampled.message).toBe(true);
    expect(brush.faceDisplacementRead(faces[0]?.faceIndex ?? -1)?.seamOffsets).toBeUndefined();
    api.invokeTool('undo');
    api.invokeTool('undo');
    expect(displacementApiSharedEdgeGapRead(targets)).toBeGreaterThan(1e-3);
    expect(api.invokeTool('sew_displacements', { faces: [{ brushId: 'missing', faceIndex: 0 }] }).ok).toBe(false);
    expect(api.invokeTool('sew_displacements', {}).ok).toBe(false);
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
