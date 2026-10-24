import * as THREE from 'three';
import { BOUNDS_FACE_USERDATA_KEY, BoundsFace } from '@/types/bounds_face.js';
import { GizmoHandle } from '@/transform/gizmo/gizmo_handle.js';
import { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import { GizmoRaycaster } from '@/transform/gizmo/gizmo_raycaster.js';
import { boundsHandleVisibleHitAcceptanceCreate } from './bounds_handle_occlusion.js';
import type { CadViewPlane } from '@/rulers/view/cad_view_plane.js';

/**
 * Picks a bounds face handle under the pointer, skipping handles hidden behind
 * the selection box in the perspective pane.
 *
 * @param gizmoRaycaster Raycaster for handle picking.
 * @param transformGizmo Gizmo owning the current bounds.
 * @param camera The viewport camera.
 * @param pickElement DOM pick target for NDC.
 * @param event The pointer event.
 * @param handles Current gizmo handles.
 * @param gizmoGroup Viewport gizmo group.
 * @param viewPlane Active pane view plane.
 * @returns Picked handle, or null.
 */
export function pickBoundsHandleFace(
  gizmoRaycaster: GizmoRaycaster,
  transformGizmo: GizmoTransform,
  camera: THREE.Camera,
  pickElement: HTMLElement,
  event: MouseEvent,
  handles: GizmoHandle[],
  gizmoGroup: THREE.Group,
  viewPlane: CadViewPlane,
): GizmoHandle | null {
  const bounds = transformGizmo.getCurrentBounds();
  const isHitAccepted = viewPlane === 'xyz' && bounds ? boundsHandleVisibleHitAcceptanceCreate(bounds) : null;
  return gizmoRaycaster.pickHandle(handles, camera, pickElement, event, gizmoGroup, isHitAccepted);
}

/**
 * Reads the bounds face stored on a handle.
 *
 * @param handle Picked handle.
 * @returns Bounds face, or null when the handle carries none.
 */
export function boundsFaceFromHandleRead(handle: GizmoHandle): BoundsFace | null {
  const face = handle.getVisualMesh().userData[BOUNDS_FACE_USERDATA_KEY];
  if (typeof face !== 'string') {
    return null;
  }
  return face as BoundsFace;
}
