import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import { DISPLACEMENT_ALPHA_MAX } from '@/displacement/model/displacement_types.js';
import { displacementSurfaceClone } from '@/displacement/model/displacement_face_surface.js';
import { CommandDisplacementEdit } from '@/displacement/commands/command_displacement_edit.js';
import { buildExportScene } from '@/io/scene/builder_export_scene.js';
import { DisplacementOverlayPresenter } from '@/displacement/overlay/displacement_overlay_presenter.js';
import type { DisplacementOverlaySurface } from '@/displacement/overlay/displacement_overlay_surface.js';
import { displacementOverlayHelperIs } from '@/displacement/overlay/displacement_overlay_helper_flags.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestSurfaceMeshFind,
  displacementTestTarget,
  type DisplacementTestRig,
} from '../displacement_test_rig.js';

/** Rig, displaced face target, presenter and its scene. */
interface PresenterTestParts {
  rig: DisplacementTestRig;
  target: SolidFaceTextureTarget;
  scene: THREE.Scene;
  presenter: DisplacementOverlayPresenter;
  faceMode: { active: boolean };
}

const presentersToDispose: DisplacementOverlayPresenter[] = [];

/**
 * Builds a box in a world inside a scene and a presenter whose helper parent is
 * the scene; the box top face is the target but is not displaced yet.
 *
 * @returns Test parts with face mode active.
 */
function presenterTestPartsCreate(): PresenterTestParts {
  const rig = displacementTestRigCreate('OverlayPresenter');
  const brush = displacementTestBoxAdd(rig, new THREE.Vector3(4, 2, 3), new THREE.Vector3(-2, 1, 5));
  const target = displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0)));
  const scene = new THREE.Scene();
  scene.add(rig.world);
  const faceMode = { active: true };
  const presenter = new DisplacementOverlayPresenter({
    helperParent: scene,
    worldRootRead: () => rig.world,
    isFaceModeActive: () => faceMode.active,
  });
  presentersToDispose.push(presenter);
  return { rig, target, scene, presenter, faceMode };
}

/**
 * Returns the surface mesh of the target face.
 *
 * @param parts Test parts.
 * @returns Surface mesh.
 */
function presenterTestSurfaceMeshRead(parts: PresenterTestParts): THREE.Mesh {
  const surfaceMesh = displacementTestSurfaceMeshFind(parts.rig, parts.target);
  if (!surfaceMesh) throw new Error('target face has no surface mesh');
  return surfaceMesh;
}

/**
 * Runs one presenter frame and returns the overlays of the target surface.
 *
 * @param parts Test parts.
 * @returns Overlays of the target surface.
 */
function presenterTestOverlayRead(parts: PresenterTestParts): DisplacementOverlaySurface {
  parts.presenter.frameUpdate();
  const overlay = parts.presenter.overlayRead(presenterTestSurfaceMeshRead(parts));
  if (!overlay?.grid) throw new Error('target surface has no grid overlay');
  return overlay;
}

/**
 * Returns the first drawn point of an overlay's grid lines.
 *
 * @param overlay Surface overlays with a grid.
 * @returns First line vertex in surface space.
 */
function presenterTestFirstGridPointRead(overlay: DisplacementOverlaySurface): THREE.Vector3 {
  const positions = overlay.grid?.lines.geometry.getAttribute('position');
  if (!positions) throw new Error('overlay has no grid');
  return new THREE.Vector3().fromBufferAttribute(positions, 0);
}

/**
 * Replaces the target displacement with a copy whose offsets and alphas are
 * changed through the undo stack.
 *
 * @param parts Test parts.
 * @param offset Offset every vertex receives.
 * @param alphaOfVertex Returns the alpha of one vertex.
 */
function presenterTestDisplacementEdit(
  parts: PresenterTestParts,
  offset: number,
  alphaOfVertex: (vertexIndex: number) => number,
): void {
  const stored = parts.rig.model.findBrush(parts.target.brushId)?.faceDisplacementRead(parts.target.surfaceIndex);
  if (!stored) throw new Error('target face has no displacement');
  const displacement = displacementSurfaceClone(stored);
  displacement.offsets = displacement.offsets.map(() => offset);
  displacement.alphas = displacement.alphas.map((_alpha, vertexIndex) => alphaOfVertex(vertexIndex));
  parts.rig.commandStack.push(new CommandDisplacementEdit([{ target: parts.target, displacement }]));
}

/**
 * Collects every object of an export scene.
 *
 * @param world World to export.
 * @returns Exported objects.
 */
function presenterTestExportObjectsRead(world: THREE.Group): THREE.Object3D[] {
  const objects: THREE.Object3D[] = [];
  buildExportScene(world).traverse((object) => objects.push(object));
  return objects;
}

/**
 * Lists the geometry attribute names of every exported mesh.
 *
 * @param world World to export.
 * @returns Sorted attribute names per exported mesh.
 */
function presenterTestExportAttributesRead(world: THREE.Group): string[][] {
  return presenterTestExportObjectsRead(world)
    .filter((object): object is THREE.Mesh => object instanceof THREE.Mesh)
    .map((mesh) => Object.keys(mesh.geometry.attributes).sort());
}

/** Displacement grid wireframes and alpha tints in the editor helper group. */
describe('DisplacementOverlayPresenter', () => {
  afterEach(() => {
    presentersToDispose.splice(0).forEach((presenter) => presenter.dispose());
    getStateFaceEditSession().reset();
    getStateDisplacementSculpt().reset();
  });

  it('adds a grid when a face is displaced and removes it on undo, back on redo', () => {
    const parts = presenterTestPartsCreate();
    parts.presenter.frameUpdate();
    expect(parts.presenter.overlayCountRead()).toBe(0);
    displacementTestCreate(parts.rig, parts.target, 3);
    const overlay = presenterTestOverlayRead(parts);
    expect(parts.presenter.overlayCountRead()).toBe(1);
    expect(overlay.grid?.root.parent).toBe(parts.presenter.overlayGroupRead());
    parts.rig.commandStack.undo();
    parts.presenter.frameUpdate();
    expect(parts.presenter.overlayCountRead()).toBe(0);
    expect(overlay.grid?.root.parent).toBeNull();
    parts.rig.commandStack.redo();
    expect(presenterTestOverlayRead(parts).grid).not.toBeNull();
    expect(parts.presenter.overlayCountRead()).toBe(1);
  });

  it('picks up displacements that existed before the presenter', () => {
    const rig = displacementTestRigCreate('OverlayPresenterExisting');
    const brush = displacementTestBoxAdd(rig, new THREE.Vector3(2, 2, 2), new THREE.Vector3(3, 0, -1));
    const target = displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(1, 0, 0)));
    displacementTestCreate(rig, target, 2);
    const presenter = new DisplacementOverlayPresenter({
      helperParent: new THREE.Scene(),
      worldRootRead: () => rig.world,
      isFaceModeActive: () => true,
    });
    presentersToDispose.push(presenter);
    presenter.frameUpdate();
    expect(presenter.overlayCountRead()).toBe(1);
  });

  it('rebuilds the grid on the new surface when the displacement is sculpted', () => {
    const parts = presenterTestPartsCreate();
    displacementTestCreate(parts.rig, parts.target, 2);
    const before = presenterTestOverlayRead(parts);
    const firstBefore = presenterTestFirstGridPointRead(before);
    presenterTestDisplacementEdit(parts, 1, () => 0);
    const after = presenterTestOverlayRead(parts);
    expect(after).not.toBe(before);
    expect(after.isCurrent()).toBe(true);
    expect(presenterTestFirstGridPointRead(after).distanceTo(firstBefore)).toBeGreaterThan(0.5);
    expect(parts.presenter.overlayCountRead()).toBe(1);
  });

  it('follows the surface back on undo of a sculpt and forward again on redo', () => {
    const parts = presenterTestPartsCreate();
    displacementTestCreate(parts.rig, parts.target, 2);
    const firstFlat = presenterTestFirstGridPointRead(presenterTestOverlayRead(parts));
    presenterTestDisplacementEdit(parts, 1, () => 0);
    const firstSculpted = presenterTestFirstGridPointRead(presenterTestOverlayRead(parts));
    expect(firstSculpted.distanceTo(firstFlat)).toBeGreaterThan(0.5);
    parts.rig.commandStack.undo();
    const undone = presenterTestOverlayRead(parts);
    expect(undone.isCurrent()).toBe(true);
    expect(presenterTestFirstGridPointRead(undone).distanceTo(firstFlat)).toBeLessThan(1e-6);
    parts.rig.commandStack.redo();
    expect(presenterTestFirstGridPointRead(presenterTestOverlayRead(parts)).distanceTo(firstSculpted)).toBeLessThan(
      1e-6,
    );
  });

  it('shows grids only in face mode with the Grid mask on', () => {
    const parts = presenterTestPartsCreate();
    displacementTestCreate(parts.rig, parts.target, 2);
    expect(presenterTestOverlayRead(parts).grid?.root.visible).toBe(true);
    getStateFaceEditSession().gridMaskWrite(false);
    expect(presenterTestOverlayRead(parts).grid?.root.visible).toBe(false);
    getStateFaceEditSession().gridMaskWrite(true);
    parts.faceMode.active = false;
    expect(presenterTestOverlayRead(parts).grid?.root.visible).toBe(false);
    parts.faceMode.active = true;
    parts.rig.model.root.visible = false;
    expect(presenterTestOverlayRead(parts).grid?.root.visible).toBe(false);
    parts.rig.model.root.visible = true;
    parts.rig.world.remove(parts.rig.model.root);
    expect(presenterTestOverlayRead(parts).grid?.root.visible).toBe(false);
    parts.rig.world.add(parts.rig.model.root);
    expect(presenterTestOverlayRead(parts).grid?.root.visible).toBe(true);
  });

  it('follows the solid model when it moves', () => {
    const parts = presenterTestPartsCreate();
    displacementTestCreate(parts.rig, parts.target, 2);
    parts.rig.model.root.position.add(new THREE.Vector3(7, -3, 2));
    parts.rig.model.root.rotation.y += 0.6;
    const overlay = presenterTestOverlayRead(parts);
    const surfaceMesh = presenterTestSurfaceMeshRead(parts);
    surfaceMesh.updateWorldMatrix(true, false);
    expect(overlay.grid?.root.matrix.equals(surfaceMesh.matrixWorld)).toBe(true);
  });

  it('keeps overlays out of the world so exports never contain them', () => {
    const parts = presenterTestPartsCreate();
    displacementTestCreate(parts.rig, parts.target, 3);
    presenterTestOverlayRead(parts);
    let overlayAncestor: THREE.Object3D | null = parts.presenter.overlayGroupRead();
    while (overlayAncestor && overlayAncestor !== parts.rig.world) overlayAncestor = overlayAncestor.parent;
    expect(overlayAncestor).toBeNull();
    const exported = presenterTestExportObjectsRead(parts.rig.world);
    expect(exported.some((object) => displacementOverlayHelperIs(object))).toBe(false);
    expect(exported.some((object) => object instanceof THREE.LineSegments)).toBe(false);
  });

  it('tints the surfaces by alpha only while Paint Alpha is active and leaves export unchanged', () => {
    const parts = presenterTestPartsCreate();
    displacementTestCreate(parts.rig, parts.target, 2);
    presenterTestDisplacementEdit(parts, 0, (vertexIndex) => (vertexIndex === 0 ? DISPLACEMENT_ALPHA_MAX : 0));
    const exportBefore = presenterTestExportAttributesRead(parts.rig.world);
    expect(presenterTestOverlayRead(parts).alphaTint.root.visible).toBe(false);
    getStateDisplacementSculpt().settingsWrite({ activeTool: 'paint_alpha' });
    const overlay = presenterTestOverlayRead(parts);
    expect(overlay.alphaTint.root.visible).toBe(true);
    const colors = overlay.alphaTint.mesh.geometry.getAttribute('color');
    expect(colors.getX(0)).toBeCloseTo(1, 6);
    expect(colors.getX(1)).toBeCloseTo(0, 6);
    expect(presenterTestSurfaceMeshRead(parts).geometry.getAttribute('color')).toBeUndefined();
    expect(presenterTestExportAttributesRead(parts.rig.world)).toEqual(exportBefore);
    exportBefore.forEach((attributeNames) => expect(attributeNames).not.toContain('color'));
    getStateDisplacementSculpt().settingsWrite({ activeTool: 'select' });
    expect(presenterTestOverlayRead(parts).alphaTint.root.visible).toBe(false);
  });

  it('removes its group from the helper parent on dispose', () => {
    const parts = presenterTestPartsCreate();
    displacementTestCreate(parts.rig, parts.target, 2);
    presenterTestOverlayRead(parts);
    parts.presenter.dispose();
    expect(parts.presenter.overlayGroupRead().parent).toBeNull();
    expect(parts.presenter.overlayCountRead()).toBe(0);
  });
});
