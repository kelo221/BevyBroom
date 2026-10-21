import * as THREE from 'three';
import type { EntityHandleTarget } from '@/entity/handles/entity_handle_drag_session.js';
import { ENTITY_HANDLE_BALL_PIXELS } from '@/entity/handles/entity_handle_overlay.js';
import { entityHandleTargetOwned } from '@/entity/handles/entity_handle_targets.js';
import { pointerEventToNdc } from '@/utils/pointer_ndc.js';

/** Extra pixels around a ball that still grab it. */
const ENTITY_HANDLE_PICK_SLACK_PIXELS = 4;

/** A pane: its camera and the element it draws into. */
export interface EntityHandlePane {
  /** Camera of the pane. */
  camera: THREE.Camera;
  /** Element the pane draws into. */
  element: HTMLElement;
}

/** A pointer position inside a pane. */
export interface EntityHandlePointer extends EntityHandlePane {
  /** Pointer event with client coordinates. */
  event: MouseEvent;
}

/**
 * Returns the client-space pixel where a handle sits in a pane.
 *
 * @param target Handle target.
 * @param pointer Pane camera and element.
 * @returns Pixel position, or null when the owner lost the handle or it is
 *   behind the camera.
 */
export function entityHandleClientPointOf(target: EntityHandleTarget, pointer: EntityHandlePane): THREE.Vector2 | null {
  const settings = target.entityOwner.settingsRead(target.owner);
  if (settings === null || !entityHandleTargetOwned(target, settings)) {
    return null;
  }
  target.owner.updateWorldMatrix(true, false);
  pointer.camera.updateMatrixWorld();
  const ndc = target.handle
    .worldPositionFor({ owner: target.owner, camera: pointer.camera }, settings)
    .project(pointer.camera);
  if (Math.abs(ndc.z) > 1) {
    return null;
  }
  const rect = pointer.element.getBoundingClientRect();
  return new THREE.Vector2(rect.left + ((ndc.x + 1) / 2) * rect.width, rect.top + ((1 - ndc.y) / 2) * rect.height);
}

/**
 * Returns the handle nearest to the pointer among those close enough to grab.
 *
 * @param targets Shown handle targets.
 * @param pointer Pointer in a pane.
 * @returns Grabbed handle, or null when none is under the pointer.
 */
export function entityHandlePickAt(
  targets: readonly EntityHandleTarget[],
  pointer: EntityHandlePointer,
): EntityHandleTarget | null {
  const pointerPixel = new THREE.Vector2(pointer.event.clientX, pointer.event.clientY);
  let nearest: EntityHandleTarget | null = null;
  let nearestDistance = ENTITY_HANDLE_BALL_PIXELS + ENTITY_HANDLE_PICK_SLACK_PIXELS;
  for (const target of targets) {
    const distance = entityHandleClientPointOf(target, pointer)?.distanceTo(pointerPixel) ?? Infinity;
    if (distance <= nearestDistance) {
      nearest = target;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/**
 * Returns the world ray under the pointer.
 *
 * @param pointer Pointer in a pane.
 * @returns World-space ray.
 */
export function entityHandleRayAt(pointer: EntityHandlePointer): THREE.Ray {
  const ndc = pointerEventToNdc(pointer.event, pointer.element);
  const raycaster = new THREE.Raycaster();
  pointer.camera.updateMatrixWorld();
  raycaster.setFromCamera(ndc, pointer.camera);
  return raycaster.ray.clone();
}
