import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { GizmoAxis } from '@/types/transform_mode.js';
import { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import { GizmoRaycaster } from '@/transform/gizmo/gizmo_raycaster.js';
import { TransformExecutor } from '@/transform/core/transform_executor.js';
import { TransformDragSession } from '@/transform/core/session_transform_drag.js';
import { ControllerRotateScaleDrag } from '@/transform/core/controller_rotate_scale_drag.js';
import { TransformModalAxis } from '@/transform/modal/transform_modal_axis.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { pointerClientPointOfWorld } from '@/utils/pointer_client_project.js';

/** Client rectangle of the fake pane. */
const PANE_RECT = new DOMRect(0, 0, 800, 600);

/** A rotate and scale controller with its session, camera and pick element. */
interface RotateScaleRig {
  controller: ControllerRotateScaleDrag;
  session: TransformDragSession;
  camera: THREE.PerspectiveCamera;
  pickElement: HTMLElement;
  rebakeCount: { value: number };
}

/**
 * Builds a controller with no keyboard lock over a camera looking down at the
 * origin from above and slightly behind.
 *
 * @returns Test rig.
 */
function rotateScaleRigCreate(): RotateScaleRig {
  const session = new TransformDragSession();
  const rebakeCount = { value: 0 };
  const controller = new ControllerRotateScaleDrag(session, {
    transformGizmo: new GizmoTransform(Theme),
    gizmoRaycaster: new GizmoRaycaster(),
    transformExecutor: new TransformExecutor(new GridSnap(false, 1)),
    modalAxisRead: () => TransformModalAxis.None,
    rebakeLockedTextures: () => {
      rebakeCount.value += 1;
    },
  });
  const camera = new THREE.PerspectiveCamera(60, PANE_RECT.width / PANE_RECT.height, 0.1, 100);
  camera.position.set(0, 8, 4);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const pickElement = document.createElement('div');
  pickElement.getBoundingClientRect = () => PANE_RECT;
  return { controller, session, camera, pickElement, rebakeCount };
}

/**
 * Creates a pointer event over a world point.
 *
 * @param rig Test rig.
 * @param worldPoint Point under the pointer.
 * @returns Pointer event at the projected client point.
 */
function pointerOver(rig: RotateScaleRig, worldPoint: THREE.Vector3): MouseEvent {
  const point = pointerClientPointOfWorld(worldPoint, rig.camera, rig.pickElement);
  return new MouseEvent('pointermove', { clientX: point.clientX, clientY: point.clientY });
}

/** Rotate and scale handle drags measured from the pre-drag snapshot. */
describe('ControllerRotateScaleDrag', () => {
  it('measures a Y handle rotation in the axis plane and rotates by the swept angle', () => {
    const rig = rotateScaleRigCreate();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    rig.session.activeAxis = GizmoAxis.Y;
    rig.session.dragActive = true;
    rig.session.snapshotPreDragState([box]);
    rig.controller.captureRotateStart(
      rig.camera,
      rig.pickElement,
      pointerOver(rig, new THREE.Vector3(2, 0, 0)),
      rig.session.dragPivot,
    );
    expect(rig.session.useScreenSpaceRotation).toBe(false);
    const quarterTurnPoint = new THREE.Vector3(0, 0, -2);
    rig.controller.handleRotateMove(rig.camera, rig.pickElement, pointerOver(rig, quarterTurnPoint), [box]);
    expect(Math.abs(rig.session.dragRotationAngle)).toBeCloseTo(Math.PI / 2, 2);
    const turnedX = new THREE.Vector3(1, 0, 0).applyQuaternion(box.quaternion);
    expect(turnedX.distanceTo(new THREE.Vector3(0, 0, -1))).toBeLessThan(1e-2);
    expect(rig.rebakeCount.value).toBe(1);
  });

  it('rotates in screen space for the view handle', () => {
    const rig = rotateScaleRigCreate();
    rig.session.activeAxis = GizmoAxis.VIEW;
    rig.controller.captureRotateStart(
      rig.camera,
      rig.pickElement,
      pointerOver(rig, new THREE.Vector3(1, 0, 0)),
      rig.session.dragPivot,
    );
    expect(rig.session.useScreenSpaceRotation).toBe(true);
    expect(rig.session.initialRotationDirection).toBeNull();
  });

  it('scales uniformly by the pivot distance ratio for the view handle', () => {
    const rig = rotateScaleRigCreate();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    rig.session.activeAxis = GizmoAxis.VIEW;
    rig.session.dragCamera = rig.camera;
    rig.session.snapshotPreDragState([box]);
    const startPoint = new THREE.Vector3(1, 0, 0);
    rig.controller.captureScaleStart(rig.camera, rig.pickElement, pointerOver(rig, startPoint), rig.session.dragPivot);
    expect(rig.session.initialDistanceAlongAxis).toBeGreaterThan(0);
    rig.controller.handleScaleMove(
      rig.camera,
      rig.pickElement,
      pointerOver(rig, startPoint.clone().multiplyScalar(2)),
      [box],
    );
    expect(rig.session.dragScaleFactor).toBeGreaterThan(1.5);
    expect(box.scale.x).toBeCloseTo(rig.session.dragScaleFactor, 6);
    expect(box.scale.y).toBeCloseTo(box.scale.x, 6);
    expect(box.scale.z).toBeCloseTo(box.scale.x, 6);
  });
});
