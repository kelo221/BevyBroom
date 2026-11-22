import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { GizmoAxis, TransformMode } from '@/types/transform_mode.js';
import { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import { GizmoRaycaster } from '@/transform/gizmo/gizmo_raycaster.js';
import { TransformExecutor } from '@/transform/core/transform_executor.js';
import { TransformConstraint } from '@/transform/core/transform_constraint.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { HandlerTransform } from '@/transform/core/handler_transform.js';
import { pointerClientPointOfWorld } from '@/utils/pointer_client_project.js';

/** Every move arrow with the world direction it is drawn along. */
const TRANSLATE_AXIS_ARROWS: ReadonlyArray<readonly [GizmoAxis, THREE.Vector3]> = [
  [GizmoAxis.X, new THREE.Vector3(1, 0, 0)],
  [GizmoAxis.Y, new THREE.Vector3(0, 1, 0)],
  [GizmoAxis.Z, new THREE.Vector3(0, 0, 1)],
];

/** Parent poses the dragged object can sit under. */
const TRANSLATE_AXIS_PARENT_TURNS: ReadonlyArray<readonly [string, THREE.Euler]> = [
  ['no turn', new THREE.Euler(0, 0, 0)],
  ['a quarter turn about Y', new THREE.Euler(0, Math.PI / 2, 0)],
  ['a turn about every axis', new THREE.Euler(0.4, 1.1, -0.7)],
];

/**
 * Drag-the-arrow environment: gizmo, handler, camera and one object in a
 * parent.
 */
interface TranslateAxisRig {
  gizmo: GizmoTransform;
  handler: HandlerTransform;
  camera: THREE.PerspectiveCamera;
  pickElement: HTMLElement;
  gizmoGroup: THREE.Group;
  object: THREE.Mesh;
}

/**
 * Proves that dragging a move arrow moves the selection along the direction the
 * arrow is drawn in, wherever the selected object sits in the hierarchy.
 */
describe('HandlerTransform move arrows', () => {
  for (const [turnName, parentTurn] of TRANSLATE_AXIS_PARENT_TURNS) {
    for (const [axis, arrowDirection] of TRANSLATE_AXIS_ARROWS) {
      it(`moves along the ${axis} arrow under a parent with ${turnName}`, () => {
        const rig = translateAxisRigCreate(parentTurn);
        const worldStart = rig.object.getWorldPosition(new THREE.Vector3());
        translateAxisRigDragArrow(rig, axis, arrowDirection);
        expect(rig.handler.getActiveAxis()).toBe(axis);
        const worldMove = rig.object.getWorldPosition(new THREE.Vector3()).sub(worldStart);
        expect(worldMove.length()).toBeGreaterThan(0.05);
        expect(worldMove.clone().normalize().dot(arrowDirection)).toBeCloseTo(1, 5);
      });
    }
  }
});

/**
 * Builds a translate gizmo at one object that sits under a turned parent.
 *
 * @param parentTurn Rotation of the object's parent.
 * @returns Rig ready for an arrow drag.
 */
function translateAxisRigCreate(parentTurn: THREE.Euler): TranslateAxisRig {
  const parent = new THREE.Group();
  parent.position.set(3, 0, -2);
  parent.rotation.copy(parentTurn);
  const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  object.position.set(1, 0.5, 0.25);
  parent.add(object);
  parent.updateMatrixWorld(true);
  const gizmo = new GizmoTransform(Theme);
  const handler = new HandlerTransform(
    gizmo,
    new GizmoRaycaster(),
    new TransformExecutor(new GridSnap(false, 1)),
    new TransformConstraint(),
  );
  const pivot = object.getWorldPosition(new THREE.Vector3());
  const camera = translateAxisCameraCreate(pivot);
  const gizmoGroup = translateAxisGizmoGroupCreate(gizmo, pivot, camera);
  const pickElement = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
  return { gizmo, handler, camera, pickElement: pickElement as unknown as HTMLElement, gizmoGroup, object };
}

/**
 * Creates a perspective camera that sees every arrow at a slant.
 *
 * @param target World point the camera looks at.
 * @returns Camera with updated matrices.
 */
function translateAxisCameraCreate(target: THREE.Vector3): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(60, 800 / 600, 0.1, 1000);
  camera.position.copy(target).add(new THREE.Vector3(-3, 2, 6));
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * Shows the translate gizmo at a pivot and returns the clone a pane draws.
 *
 * @param gizmo Gizmo under test.
 * @param pivot World pivot of the selection.
 * @param camera Camera of the pane.
 * @returns Visible gizmo clone sized for the camera.
 */
function translateAxisGizmoGroupCreate(gizmo: GizmoTransform, pivot: THREE.Vector3, camera: THREE.Camera): THREE.Group {
  gizmo.setMode(TransformMode.TRANSLATE);
  gizmo.setVisible(true);
  gizmo.setPivot(pivot);
  const gizmoGroup = gizmo.getHandleGroupClone();
  gizmoGroup.visible = true;
  gizmo.prepareTransformCloneForCamera(gizmoGroup, camera);
  gizmoGroup.updateMatrixWorld(true);
  return gizmoGroup;
}

/**
 * Presses on the far end of one arrow and drags the pointer further along it.
 *
 * @param rig Drag environment.
 * @param axis Arrow to grab.
 * @param arrowDirection World direction the arrow is drawn along.
 */
function translateAxisRigDragArrow(rig: TranslateAxisRig, axis: GizmoAxis, arrowDirection: THREE.Vector3): void {
  const pivot = rig.gizmoGroup.position.clone();
  const arrowLength = rig.gizmoGroup.getWorldScale(new THREE.Vector3()).x;
  const grabPoint = pivot.clone().addScaledVector(arrowDirection, arrowLength * 0.9);
  const releasePoint = grabPoint.clone().addScaledVector(arrowDirection, 0.5);
  const grab = pointerClientPointOfWorld(grabPoint, rig.camera, rig.pickElement);
  const release = pointerClientPointOfWorld(releasePoint, rig.camera, rig.pickElement);
  const objects = [rig.object];
  const down = new MouseEvent('pointerdown', { clientX: grab.clientX, clientY: grab.clientY });
  rig.handler.onPointerDown(rig.camera, rig.pickElement, down, rig.gizmo.getHandles(), objects, pivot, rig.gizmoGroup);
  expect(rig.handler.getActiveAxis()).toBe(axis);
  const move = new MouseEvent('pointermove', { clientX: release.clientX, clientY: release.clientY });
  rig.handler.onPointerMove(rig.camera, rig.pickElement, move, pivot, objects);
  rig.object.updateMatrixWorld(true);
}
