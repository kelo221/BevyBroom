import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { SelectionMode } from '@/types/selection_mode.js';
import { ControllerFaceUvTools } from '@/texture/controller/controller_face_uv_tools.js';
import { initializeMeshTextureUVs } from '@/texture/uv/face_texture_applier.js';
import { getFaceTextureMaps } from '@/texture/uv/face_texture_storage.js';
import { faceUvNudgeStepResolve, faceUvRotateStepResolve } from '@/texture/controller/face_uv_tool_steps.js';
import { FaceUvOperationContext } from '@/texture/uv/operations/face_uv_operation_context.js';
import { DEFAULT_CHECKER_TEXTURE_ID } from '@/texture/library/texture_id.js';

describe('ControllerFaceUvTools', () => {
  let world: THREE.Group;
  let selection: ManagerSelection;
  let faceController: ControllerFaceExtrusion;
  let commandStack: CommandStack;
  let gridSnap: GridSnap;
  let controller: ControllerFaceUvTools;
  let mesh: THREE.Mesh;

  beforeEach(() => {
    world = new THREE.Group();
    selection = new ManagerSelection();
    commandStack = new CommandStack(64);
    gridSnap = new GridSnap(false, 1);
    faceController = new ControllerFaceExtrusion(new THREE.Scene(), commandStack, gridSnap, world);
    controller = new ControllerFaceUvTools(
      selection,
      faceController,
      commandStack,
      gridSnap,
      () => ({ right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0) }),
      () => ({ shift: false, ctrl: false }),
    );
    mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    mesh.updateMatrixWorld(true);
    initializeMeshTextureUVs(mesh, DEFAULT_CHECKER_TEXTURE_ID);
    world.add(mesh);
    faceController.setSelectionMode(SelectionMode.FACE);
    faceController.selectFace(mesh, topFaceSeed(mesh), false);
  });

  it('pushes exactly one undo entry per tool invocation', () => {
    controller.fit('both');
    expect(commandStack.getUndoCount()).toBe(1);
    controller.justify('left');
    expect(commandStack.getUndoCount()).toBe(2);
  });

  it('fits the selected face so one tile spans it', () => {
    controller.fit('u');
    const entry = topFaceMapEntry(mesh);
    expect(entry).toBeDefined();
    const context = topFaceContext(mesh);
    const bounds = context.uvBounds(
      (entry as { mapping: { uv: import('@/texture/uv_matrix/surface_uv_matrix.js').SurfaceUvMatrix } }).mapping.uv,
    );
    expect(bounds.maxU - bounds.minU).toBeCloseTo(1, 4);
  });

  it('nudges by the grid interval and honors modifiers', () => {
    expect(faceUvNudgeStepResolve(0.5, { shift: false, ctrl: false })).toBeCloseTo(0.5, 6);
    expect(faceUvNudgeStepResolve(0.5, { shift: true, ctrl: false })).toBeCloseTo(1, 6);
    expect(faceUvNudgeStepResolve(0.5, { shift: false, ctrl: true })).toBeCloseTo(0.01, 6);
    expect(faceUvRotateStepResolve(15, { shift: false, ctrl: false })).toBe(15);
    expect(faceUvRotateStepResolve(15, { shift: true, ctrl: false })).toBe(90);
    expect(faceUvRotateStepResolve(15, { shift: false, ctrl: true })).toBe(1);
  });

  it('reports status flags for a single selected face', () => {
    expect(controller.readSelectionStatus()).not.toBeNull();
    controller.fit('both');
    const status = controller.readSelectionStatus();
    expect(status?.fittedU).toBe(true);
    expect(status?.fittedV).toBe(true);
  });

  it('reports null status without a single face selection', () => {
    faceController.setSelectionMode(SelectionMode.OBJECT);
    expect(controller.readSelectionStatus()).toBeNull();
  });

  it('does nothing without a usable selection', () => {
    faceController.setSelectionMode(SelectionMode.OBJECT);
    selection.clearSelection();
    controller.fit('both');
    expect(commandStack.getUndoCount()).toBe(0);
  });

  it('undoes a tool edit back to the prior UVs', () => {
    const before = JSON.stringify(getFaceTextureMaps(mesh).map((entry) => entry.mapping.uv.serialize()));
    controller.rotate(90);
    commandStack.undo();
    const after = JSON.stringify(getFaceTextureMaps(mesh).map((entry) => entry.mapping.uv.serialize()));
    expect(after).toBe(before);
  });

  it('keeps the face-mode gate closed without selected faces', () => {
    faceController.setSelectionMode(SelectionMode.OBJECT);
    expect(controller.faceModeHasSelectedFaces()).toBe(false);
    faceController.setSelectionMode(SelectionMode.FACE);
    faceController.selectFace(mesh, topFaceSeed(mesh), false);
    expect(controller.faceModeHasSelectedFaces()).toBe(true);
  });
});

/**
 * Finds the seed triangle of a box top face.
 *
 * @param mesh Box mesh.
 * @returns Triangle index touching the top face.
 */
function topFaceSeed(mesh: THREE.Mesh): number {
  const position = mesh.geometry.getAttribute('position');
  const index = mesh.geometry.getIndex();
  const triangleCount = Math.floor((index?.count ?? position.count) / 3);
  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex++) {
    const vertexIndex = index ? index.getX(triangleIndex * 3) : triangleIndex * 3;
    if (position.getY(vertexIndex) > 0.9) {
      return triangleIndex;
    }
  }
  throw new Error('box has no top face triangles');
}

/**
 * Reads the stored mapping of the top face region.
 *
 * @param mesh Box mesh under test.
 * @returns Face map entry of the top region.
 */
function topFaceMapEntry(mesh: THREE.Mesh): ReturnType<typeof getFaceTextureMaps>[number] | undefined {
  const seed = topFaceSeed(mesh);
  return getFaceTextureMaps(mesh).find((entry) => entry.triangleIndices.includes(seed));
}

/**
 * Builds the world context of the top face.
 *
 * @param mesh Box mesh under test.
 * @returns Context of the top face polygon.
 */
function topFaceContext(mesh: THREE.Mesh): FaceUvOperationContext {
  return new FaceUvOperationContext({
    vertices: [
      new THREE.Vector3(-1, 1, -1),
      new THREE.Vector3(1, 1, -1),
      new THREE.Vector3(1, 1, 1),
      new THREE.Vector3(-1, 1, 1),
    ].map((corner) => corner.clone().applyMatrix4(mesh.matrixWorld)),
    faceNormal: new THREE.Vector3(0, 1, 0)
      .applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld))
      .normalize(),
  });
}
