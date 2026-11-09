import * as THREE from 'three';
import { Theme } from '@/theme.js';
import type { BoundsFace } from '@/types/bounds_face.js';
import { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import { TransformMode } from '@/types/transform_mode.js';
import { pointerClientPointOfWorld } from '@/utils/pointer_client_project.js';
import { BoundsHandleSquareStyler } from '@/transform/bounds/handle/bounds_handle_square.js';
import { boundsHandleFacesEqual, boundsHandleFacesRead } from '@/transform/bounds/handle/bounds_handle_faces.js';

/** Client rectangle of the fake top pane. */
export const BOUNDS_TOP_PANE_RECT = new DOMRect(0, 0, 800, 600);

/** A selected box in bounds mode seen by a top orthographic camera. */
export interface BoundsTopPaneRig {
  /** Gizmo in bounds mode around the box. */
  gizmo: GizmoTransform;
  /** Selected box. */
  box: THREE.Mesh;
  /** Styled top pane gizmo clone. */
  gizmoGroup: THREE.Group;
  /** Top camera over the box. */
  camera: THREE.OrthographicCamera;
  /** Pick element spanning the pane rectangle. */
  pickElement: HTMLElement;
}

/**
 * Builds a selected box in bounds mode, a top camera over it and a styled top
 * pane gizmo clone.
 *
 * @returns Test rig.
 */
export function boundsTopPaneRigCreate(): BoundsTopPaneRig {
  const box = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 2), new THREE.MeshBasicMaterial());
  box.position.set(1.5, 0.5, -0.5);
  box.updateMatrixWorld(true);
  const gizmo = new GizmoTransform(Theme);
  gizmo.setMode(TransformMode.BOUNDS);
  gizmo.setVisible(true);
  gizmo.updateBoundsFromMeshes([box]);
  const camera = boundsTopPaneCameraCreate(box.position);
  const gizmoGroup = boundsTopPaneCloneCreate(gizmo, camera);
  const pickElement = document.createElement('div');
  pickElement.getBoundingClientRect = () => BOUNDS_TOP_PANE_RECT;
  return { gizmo, box, gizmoGroup, camera, pickElement };
}

/**
 * Creates the styled, visible top pane clone of a gizmo.
 *
 * @param gizmo Gizmo in bounds mode.
 * @param camera Top camera of the pane.
 * @returns Pane gizmo clone with up-to-date world matrices.
 */
function boundsTopPaneCloneCreate(gizmo: GizmoTransform, camera: THREE.Camera): THREE.Group {
  const gizmoGroup = gizmo.getHandleGroupClone('xz');
  gizmo.prepareBoundsCloneForCamera(gizmoGroup, camera, 'xz', BOUNDS_TOP_PANE_RECT.height);
  gizmoGroup.visible = true;
  gizmoGroup.updateMatrixWorld(true);
  return gizmoGroup;
}

/**
 * Creates a top orthographic camera centered over a point.
 *
 * @param target Point to look at.
 * @returns Camera looking down −Y with −Z up on screen.
 */
function boundsTopPaneCameraCreate(target: THREE.Vector3): THREE.OrthographicCamera {
  const aspect = BOUNDS_TOP_PANE_RECT.width / BOUNDS_TOP_PANE_RECT.height;
  const halfHeight = 4;
  const camera = new THREE.OrthographicCamera(
    -halfHeight * aspect,
    halfHeight * aspect,
    halfHeight,
    -halfHeight,
    0.1,
    500,
  );
  camera.position.copy(target).add(new THREE.Vector3(0, 40, 0));
  camera.up.set(0, 0, -1);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * Finds the world position of the visible square that drags the given faces.
 *
 * @param rig Test rig.
 * @param faces Faces of the wanted square.
 * @returns World position of the square.
 */
export function boundsTopPaneSquareWorldPosition(rig: BoundsTopPaneRig, faces: readonly BoundsFace[]): THREE.Vector3 {
  let found: THREE.Vector3 | null = null;
  rig.gizmoGroup.traverse((child) => {
    if (!BoundsHandleSquareStyler.isSquare(child) || !child.visible) return;
    if (boundsHandleFacesEqual(boundsHandleFacesRead(child), faces)) {
      found = child.getWorldPosition(new THREE.Vector3());
    }
  });
  if (!found) {
    throw new Error(`No visible square for ${faces.join(',')}`);
  }
  return found;
}

/**
 * Creates a pointer event over a world point.
 *
 * @param rig Test rig.
 * @param type Event type.
 * @param worldPoint Point under the pointer.
 * @returns Pointer event at the projected client point.
 */
export function boundsTopPanePointerOver(rig: BoundsTopPaneRig, type: string, worldPoint: THREE.Vector3): MouseEvent {
  const point = pointerClientPointOfWorld(worldPoint, rig.camera, rig.pickElement);
  return new MouseEvent(type, { clientX: point.clientX, clientY: point.clientY, button: 0 });
}

/**
 * Returns the world corner of a box on the given sides in X and Z.
 *
 * @param box World box.
 * @param signX −1 for min X, +1 for max X.
 * @param signZ −1 for min Z, +1 for max Z.
 * @returns Corner point at height zero.
 */
export function boundsTopPaneBoxCornerXZ(box: THREE.Box3, signX: number, signZ: number): THREE.Vector3 {
  return new THREE.Vector3(signX > 0 ? box.max.x : box.min.x, 0, signZ > 0 ? box.max.z : box.min.z);
}
