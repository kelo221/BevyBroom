import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { BoundsFace } from '@/types/bounds_face.js';
import { ControllerBoundsDrag } from '@/transform/bounds/controller_bounds_drag.js';
import { TransformDragSession } from '@/transform/core/session_transform_drag.js';
import { TransformExecutor } from '@/transform/core/transform_executor.js';
import { GizmoRaycaster } from '@/transform/gizmo/gizmo_raycaster.js';
import { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { TransformMode } from '@/types/transform_mode.js';
import { pointerClientPointOfWorld } from '@/utils/pointer_client_project.js';

/** Client rectangle of the fake perspective viewport. */
const VIEWPORT_RECT = new DOMRect(0, 0, 800, 600);

/** A selected box in bounds mode seen by a perspective camera from above. */
interface HiddenHandleRig {
  controller: ControllerBoundsDrag;
  session: TransformDragSession;
  gizmo: GizmoTransform;
  raycaster: GizmoRaycaster;
  box: THREE.Mesh;
  gizmoGroup: THREE.Group;
  camera: THREE.PerspectiveCamera;
  pickElement: HTMLElement;
}

/**
 * Builds a wide, flat selected box in bounds mode and a camera looking down at
 * it at an angle.
 *
 * @returns Test rig.
 */
function hiddenHandleRigCreate(): HiddenHandleRig {
  const session = new TransformDragSession();
  const gizmo = new GizmoTransform(Theme);
  gizmo.setMode(TransformMode.BOUNDS);
  gizmo.setVisible(true);
  const box = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.5, 2), new THREE.MeshBasicMaterial());
  box.position.set(-0.125, 0.25, 0);
  box.updateMatrixWorld(true);
  gizmo.updateBoundsFromMeshes([box]);
  const gizmoGroup = gizmo.getHandleGroupClone();
  gizmoGroup.visible = true;
  gizmoGroup.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(60, VIEWPORT_RECT.width / VIEWPORT_RECT.height, 0.1, 500);
  camera.position.set(6, 7, 8);
  camera.lookAt(box.position);
  camera.updateMatrixWorld(true);
  const pickElement = document.createElement('div');
  pickElement.getBoundingClientRect = () => VIEWPORT_RECT;
  const raycaster = new GizmoRaycaster();
  const controller = new ControllerBoundsDrag(session, gizmo, raycaster, new TransformExecutor(new GridSnap(false, 1)));
  return { controller, session, gizmo, raycaster, box, gizmoGroup, camera, pickElement };
}

/**
 * Returns the world center of the resize handle of a face.
 *
 * @param rig Test rig.
 * @param face Bounds face.
 * @returns World position of the handle pick volume.
 */
function handleWorldPosition(rig: HiddenHandleRig, face: BoundsFace): THREE.Vector3 {
  const handle = rig.gizmoGroup.getObjectByName(`bounds_handle_${face}`);
  if (!handle) {
    throw new Error(`No resize handle for ${face}`);
  }
  return handle.getWorldPosition(new THREE.Vector3());
}

/**
 * Creates a pointer press over a world point.
 *
 * @param rig Test rig.
 * @param worldPoint Point under the pointer.
 * @returns Pointer event at the projected client point.
 */
function pressOver(rig: HiddenHandleRig, worldPoint: THREE.Vector3): MouseEvent {
  const point = pointerClientPointOfWorld(worldPoint, rig.camera, rig.pickElement);
  return new MouseEvent('pointerdown', { clientX: point.clientX, clientY: point.clientY, button: 0 });
}

/**
 * Returns the point where the camera ray toward the bottom handle enters the
 * box: a point on a visible face whose ray continues into the hidden handle.
 *
 * @param rig Test rig.
 * @returns World point on the box surface.
 */
function visibleSurfacePointInFrontOfBottomHandle(rig: HiddenHandleRig): THREE.Vector3 {
  const target = handleWorldPosition(rig, BoundsFace.NEG_Y);
  const ray = new THREE.Ray(rig.camera.position.clone(), target.sub(rig.camera.position).normalize());
  const entry = ray.intersectBox(new THREE.Box3().setFromObject(rig.box), new THREE.Vector3());
  if (!entry) {
    throw new Error('The camera ray toward the bottom handle must cross the box');
  }
  return entry;
}

/**
 * Reproduces the hidden-handle press: a press on the visible top of a selected
 * box whose pick ray continues through the box into the bottom resize handle
 * must not start a resize, while visible handles keep working.
 */
describe('ControllerBoundsDrag hidden resize handles', () => {
  it('ignores the bottom handle hidden behind the box under a press on its top', () => {
    const rig = hiddenHandleRigCreate();
    const surfacePoint = visibleSurfacePointInFrontOfBottomHandle(rig);
    const event = pressOver(rig, surfacePoint);
    const unfilteredPick = rig.raycaster.pickHandle(
      rig.gizmo.getHandles(),
      rig.camera,
      rig.pickElement,
      event,
      rig.gizmoGroup,
    );
    expect(unfilteredPick).not.toBeNull();
    const handles = rig.gizmo.getHandles();
    expect(rig.controller.probeControlUnderPointer(rig.camera, rig.pickElement, event, handles, rig.gizmoGroup)).toBe(
      false,
    );
    rig.controller.beginPointerDown(
      rig.camera,
      rig.pickElement,
      event,
      handles,
      [rig.box],
      rig.box.position.clone(),
      rig.gizmoGroup,
    );
    expect(rig.session.dragActive).toBe(false);
  });

  it('still resizes from a handle the viewer can see', () => {
    const rig = hiddenHandleRigCreate();
    const event = pressOver(rig, handleWorldPosition(rig, BoundsFace.POS_Y));
    const handles = rig.gizmo.getHandles();
    expect(rig.controller.probeControlUnderPointer(rig.camera, rig.pickElement, event, handles, rig.gizmoGroup)).toBe(
      true,
    );
    rig.controller.beginPointerDown(
      rig.camera,
      rig.pickElement,
      event,
      handles,
      [rig.box],
      rig.box.position.clone(),
      rig.gizmoGroup,
    );
    expect(rig.session.dragActive).toBe(true);
    expect(rig.session.isBoundsResize).toBe(true);
  });
});
