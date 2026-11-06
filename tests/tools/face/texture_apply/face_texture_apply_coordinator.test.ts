import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getStateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import {
  getStateFaceEditSession,
  setStateFaceEditSessionForTests,
  StateFaceEditSession,
} from '@/texture/paint/state_face_edit_session.js';
import { getStateTextureStampTool } from '@/tools/texture_stamp/state_texture_stamp_tool.js';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import type { FaceTextureMapping } from '@/texture/uv/face_texture_mapping.js';
import { faceUvRowMagnitude } from '@/texture/uv/operations/face_uv_operation_math.js';
import { alignToViewProjectOntoPlane } from '@/texture/uv/operations/face_uv_operation_align_to_view.js';
import { FACE_SECONDARY_CLICK_DRAG_THRESHOLD_PX } from '@/tools/face/texture_apply/face_secondary_click_gesture.js';
import {
  FACE_TEXTURE_APPLY_TEST_START_TEXTURE,
  faceTextureApplyTestClientPoint,
  faceTextureApplyTestFacePaint,
  faceTextureApplyTestFaceSeed,
  faceTextureApplyTestMappingRead,
  faceTextureApplyTestMouseEvent,
  faceTextureApplyTestSceneCreate,
  faceTextureApplyTestSceneDispose,
  faceTextureApplyTestSharedCorners,
  type FaceTextureApplyTestScene,
} from './face_texture_apply_test_scene.js';

/** Texture the tests make current before applying. */
const CURRENT_TEXTURE = 'walls/current_texture.png';

/** Texture of the face the tests lift. */
const LIFTED_TEXTURE = 'walls/lifted_texture.png';

/** World directions of the box faces the camera sees. */
const TOP = new THREE.Vector3(0, 1, 0);
const FRONT = new THREE.Vector3(0, 0, 1);
const RIGHT = new THREE.Vector3(1, 0, 0);

/**
 * Reads the mapping of the face pointing along a direction.
 *
 * @param scene Test scene.
 * @param direction Face normal direction.
 * @returns Stored mapping.
 */
function mappingRead(scene: FaceTextureApplyTestScene, direction: THREE.Vector3): FaceTextureMapping {
  return faceTextureApplyTestMappingRead(scene.mesh, faceTextureApplyTestFaceSeed(scene.mesh, direction));
}

/**
 * Serializes the UV matrix of a face for exact comparisons.
 *
 * @param scene Test scene.
 * @param direction Face normal direction.
 * @returns Serialized matrix.
 */
function uvSnapshot(scene: FaceTextureApplyTestScene, direction: THREE.Vector3): string {
  return JSON.stringify(mappingRead(scene, direction).uv.serialize());
}

/**
 * Presses and releases the right button over a face, optionally dragging.
 *
 * @param scene Test scene.
 * @param direction Normal direction of the face under the press.
 * @param release Drag distance before the release and Alt state at release.
 */
function rightClick(
  scene: FaceTextureApplyTestScene,
  direction: THREE.Vector3,
  release: { dragPx: number; altKey: boolean },
): void {
  const point = faceTextureApplyTestClientPoint(scene, faceTextureApplyTestFaceSeed(scene.mesh, direction));
  scene.coordinator.secondaryPressBegin(scene.viewport, point.clientX, point.clientY);
  if (release.dragPx > 0) {
    const moved = { clientX: point.clientX + release.dragPx, clientY: point.clientY };
    window.dispatchEvent(new PointerEvent('pointermove', { ...moved, movementX: release.dragPx, buttons: 2 }));
  }
  window.dispatchEvent(new PointerEvent('pointerup', { ...point, button: 2, altKey: release.altKey }));
}

/**
 * Presses the left button over a face.
 *
 * @param scene Test scene.
 * @param direction Normal direction of the face under the press.
 * @returns True when the press was consumed.
 */
function leftPress(scene: FaceTextureApplyTestScene, direction: THREE.Vector3): boolean {
  const point = faceTextureApplyTestClientPoint(scene, faceTextureApplyTestFaceSeed(scene.mesh, direction));
  return scene.coordinator.primaryPressTryHandle(faceTextureApplyTestMouseEvent(point), scene.viewport, false);
}

/**
 * Paints the lifted texture with a rotated, shifted and scaled alignment on a
 * face.
 *
 * @param scene Test scene.
 * @param direction Face normal direction.
 */
function liftedFacePaint(scene: FaceTextureApplyTestScene, direction: THREE.Vector3): void {
  const uv = SurfaceUvMatrix.fromTrs(new THREE.Vector2(0.37, -0.21), direction, 23, 0.8, 1.3);
  faceTextureApplyTestFacePaint(scene, direction, LIFTED_TEXTURE, uv);
}

/**
 * Expects the texture to continue across the edge two faces share.
 *
 * @param scene Test scene.
 * @param sourceDirection Normal of the face whose alignment was copied.
 * @param targetDirection Normal of the face that received it.
 */
function expectContinuousAcrossSharedEdge(
  scene: FaceTextureApplyTestScene,
  sourceDirection: THREE.Vector3,
  targetDirection: THREE.Vector3,
): void {
  const sourceUv = mappingRead(scene, sourceDirection).uv;
  const targetUv = mappingRead(scene, targetDirection).uv;
  const corners = faceTextureApplyTestSharedCorners(
    scene.mesh,
    faceTextureApplyTestFaceSeed(scene.mesh, sourceDirection),
    faceTextureApplyTestFaceSeed(scene.mesh, targetDirection),
  );
  expect(corners.length).toBe(2);
  corners.forEach((corner) => {
    expect(targetUv.project(corner).u).toBeCloseTo(sourceUv.project(corner).u, 6);
    expect(targetUv.project(corner).v).toBeCloseTo(sourceUv.project(corner).v, 6);
  });
}

describe('FaceTextureApplyCoordinator', () => {
  let scene: FaceTextureApplyTestScene;

  beforeEach(() => {
    setStateFaceEditSessionForTests(new StateFaceEditSession());
    getStateTexturePaint().reset();
    scene = faceTextureApplyTestSceneCreate();
  });

  afterEach(() => {
    faceTextureApplyTestSceneDispose(scene);
    getStateTextureStampTool().toolActiveWrite(false);
    setStateFaceEditSessionForTests(null);
    getStateTexturePaint().reset();
  });

  it('applies the current texture to the right-clicked face only, keeping its alignment, as one undo step', () => {
    const frontUvBefore = uvSnapshot(scene, FRONT);
    const undoCountBefore = scene.commandStack.getUndoCount();
    getStateTexturePaint().setLastTextureId(CURRENT_TEXTURE);
    rightClick(scene, FRONT, { dragPx: 0, altKey: false });
    expect(mappingRead(scene, FRONT).textureId).toBe(CURRENT_TEXTURE);
    expect(uvSnapshot(scene, FRONT)).toBe(frontUvBefore);
    expect(mappingRead(scene, TOP).textureId).toBe(FACE_TEXTURE_APPLY_TEST_START_TEXTURE);
    expect(scene.commandStack.getUndoCount()).toBe(undoCountBefore + 1);
    scene.commandStack.undo();
    expect(mappingRead(scene, FRONT).textureId).toBe(FACE_TEXTURE_APPLY_TEST_START_TEXTURE);
  });

  it('keeps a right-button drag for the camera and applies nothing', () => {
    const undoCountBefore = scene.commandStack.getUndoCount();
    getStateTexturePaint().setLastTextureId(CURRENT_TEXTURE);
    rightClick(scene, FRONT, { dragPx: FACE_SECONDARY_CLICK_DRAG_THRESHOLD_PX * 3, altKey: false });
    expect(mappingRead(scene, FRONT).textureId).toBe(FACE_TEXTURE_APPLY_TEST_START_TEXTURE);
    expect(scene.commandStack.getUndoCount()).toBe(undoCountBefore);
  });

  it('suppresses the browser context menu while a right press is armed', async () => {
    const point = faceTextureApplyTestClientPoint(scene, faceTextureApplyTestFaceSeed(scene.mesh, FRONT));
    scene.coordinator.secondaryPressBegin(scene.viewport, point.clientX, point.clientY);
    const duringPress = new MouseEvent('contextmenu', { cancelable: true, bubbles: true });
    window.dispatchEvent(duringPress);
    expect(duringPress.defaultPrevented).toBe(true);
    window.dispatchEvent(new PointerEvent('pointerup', { ...point, button: 2 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const afterRelease = new MouseEvent('contextmenu', { cancelable: true, bubbles: true });
    window.dispatchEvent(afterRelease);
    expect(afterRelease.defaultPrevented).toBe(false);
  });

  it('applies the current texture with the lifted values so the texture continues across the shared edge', () => {
    liftedFacePaint(scene, TOP);
    getStateFaceEditSession().pickModeWrite('lift');
    expect(leftPress(scene, TOP)).toBe(true);
    expect(getStateTexturePaint().getLastTextureId()).toBe(LIFTED_TEXTURE);
    getStateTexturePaint().setLastTextureId(CURRENT_TEXTURE);
    const undoCountBefore = scene.commandStack.getUndoCount();
    rightClick(scene, FRONT, { dragPx: 0, altKey: true });
    expect(mappingRead(scene, FRONT).textureId).toBe(CURRENT_TEXTURE);
    expect(mappingRead(scene, TOP).textureId).toBe(LIFTED_TEXTURE);
    expectContinuousAcrossSharedEdge(scene, TOP, FRONT);
    expect(scene.commandStack.getUndoCount()).toBe(undoCountBefore + 1);
  });

  it('falls back to the primary selected face for texture + values without a lifted face', () => {
    liftedFacePaint(scene, TOP);
    scene.faceController.selectFace(scene.mesh, faceTextureApplyTestFaceSeed(scene.mesh, TOP), false);
    getStateTexturePaint().setLastTextureId(CURRENT_TEXTURE);
    rightClick(scene, RIGHT, { dragPx: 0, altKey: true });
    expect(mappingRead(scene, RIGHT).textureId).toBe(CURRENT_TEXTURE);
    expectContinuousAcrossSharedEdge(scene, TOP, RIGHT);
  });

  it('applies the texture only on a left click in Apply (texture only) mode', () => {
    const frontUvBefore = uvSnapshot(scene, FRONT);
    getStateTexturePaint().setLastTextureId(CURRENT_TEXTURE);
    getStateFaceEditSession().pickModeWrite('apply');
    expect(leftPress(scene, FRONT)).toBe(true);
    expect(mappingRead(scene, FRONT).textureId).toBe(CURRENT_TEXTURE);
    expect(uvSnapshot(scene, FRONT)).toBe(frontUvBefore);
    expect(scene.faceController.getSelectedFaceCount()).toBe(0);
  });

  it('applies the texture and lifted values on a left click in Apply (texture + values) mode', () => {
    liftedFacePaint(scene, TOP);
    getStateFaceEditSession().pickModeWrite('lift');
    leftPress(scene, TOP);
    getStateTexturePaint().setLastTextureId(CURRENT_TEXTURE);
    getStateFaceEditSession().pickModeWrite('apply_values');
    expect(leftPress(scene, RIGHT)).toBe(true);
    expect(mappingRead(scene, RIGHT).textureId).toBe(CURRENT_TEXTURE);
    expectContinuousAcrossSharedEdge(scene, TOP, RIGHT);
  });

  it('projects the current texture from the camera on a left click in Align to View mode', () => {
    const before = mappingRead(scene, RIGHT).uv.clone();
    const undoCountBefore = scene.commandStack.getUndoCount();
    getStateTexturePaint().setLastTextureId(CURRENT_TEXTURE);
    getStateFaceEditSession().pickModeWrite('align_view');
    expect(leftPress(scene, RIGHT)).toBe(true);
    const aligned = mappingRead(scene, RIGHT);
    const cameraRight = new THREE.Vector3().setFromMatrixColumn(scene.camera.matrixWorld, 0).normalize();
    const cameraUp = new THREE.Vector3().setFromMatrixColumn(scene.camera.matrixWorld, 1).normalize();
    const expectedU = alignToViewProjectOntoPlane(cameraRight, RIGHT).multiplyScalar(faceUvRowMagnitude(before.u));
    const expectedV = alignToViewProjectOntoPlane(cameraUp, RIGHT).multiplyScalar(faceUvRowMagnitude(before.v));
    expect(new THREE.Vector3(aligned.uv.u.x, aligned.uv.u.y, aligned.uv.u.z).distanceTo(expectedU)).toBeLessThan(1e-6);
    expect(new THREE.Vector3(aligned.uv.v.x, aligned.uv.v.y, aligned.uv.v.z).distanceTo(expectedV)).toBeLessThan(1e-6);
    expect(aligned.textureId).toBe(CURRENT_TEXTURE);
    expect(scene.commandStack.getUndoCount()).toBe(undoCountBefore + 1);
    scene.commandStack.undo();
    const restored = mappingRead(scene, RIGHT);
    expect(restored.textureId).toBe(FACE_TEXTURE_APPLY_TEST_START_TEXTURE);
    expect(JSON.stringify(restored.uv.serialize())).toBe(JSON.stringify(before.serialize()));
  });

  it('lifts without consuming the press in Lift+Select and leaves Select alone', () => {
    liftedFacePaint(scene, TOP);
    const undoCountBefore = scene.commandStack.getUndoCount();
    getStateFaceEditSession().pickModeWrite('select');
    expect(leftPress(scene, TOP)).toBe(false);
    expect(getStateTexturePaint().getLastTextureId()).not.toBe(LIFTED_TEXTURE);
    getStateFaceEditSession().pickModeWrite('lift_select');
    expect(leftPress(scene, TOP)).toBe(false);
    expect(getStateTexturePaint().getLastTextureId()).toBe(LIFTED_TEXTURE);
    expect(scene.commandStack.getUndoCount()).toBe(undoCountBefore);
  });

  it('stamps the current texture on a left click while the Apply Current Texture tool is active', () => {
    const undoCountBefore = scene.commandStack.getUndoCount();
    getStateTexturePaint().setLastTextureId(CURRENT_TEXTURE);
    getStateFaceEditSession().pickModeWrite('select');
    getStateTextureStampTool().toolActiveWrite(true);
    expect(leftPress(scene, FRONT)).toBe(true);
    expect(mappingRead(scene, FRONT).textureId).toBe(CURRENT_TEXTURE);
    expect(scene.commandStack.getUndoCount()).toBe(undoCountBefore + 1);
  });

  it('stamps the current texture onto the selected faces when the tool is chosen', () => {
    scene.faceController.selectFace(scene.mesh, faceTextureApplyTestFaceSeed(scene.mesh, TOP), false);
    getStateTexturePaint().setLastTextureId(CURRENT_TEXTURE);
    scene.coordinator.stampApplyToSelection();
    expect(mappingRead(scene, TOP).textureId).toBe(CURRENT_TEXTURE);
    expect(mappingRead(scene, FRONT).textureId).toBe(FACE_TEXTURE_APPLY_TEST_START_TEXTURE);
  });
});
