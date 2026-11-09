import * as THREE from 'three';
import { BOUNDS_FACE_USERDATA_KEY, BoundsFace } from '@/types/bounds_face.js';
import { GizmoHandle } from '@/transform/gizmo/gizmo_handle.js';
import { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import { GizmoRaycaster } from '@/transform/gizmo/gizmo_raycaster.js';
import { boundsHandleVisibleHitAcceptanceCreate } from './bounds_handle_occlusion.js';
import type { CadViewPlane } from '@/rulers/view/cad_view_plane.js';
import { boundsHandleFacesRead } from './handle/bounds_handle_faces.js';

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
 * Reads every bounds face a handle drags: one for an edge handle, two for a
 * corner handle.
 *
 * @param handle Picked handle.
 * @returns Dragged faces; empty when the handle carries none.
 */
export function boundsHandleFacesFromHandleRead(handle: GizmoHandle): readonly BoundsFace[] {
  return boundsHandleFacesRead(handle.getVisualMesh());
}

/**
 * Reads the single bounds face stored on an edge handle. Corner handles carry
 * no single face.
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
