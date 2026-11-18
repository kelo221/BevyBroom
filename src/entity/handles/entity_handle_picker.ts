import * as THREE from 'three';
import type { EntityHandleTarget } from '@/entity/handles/entity_handle_drag_session.js';
import { ENTITY_HANDLE_BALL_PIXELS } from '@/entity/handles/entity_handle_overlay.js';
import { entityHandleTargetOwned } from '@/entity/handles/entity_handle_targets.js';
import { pointerEventToNdc } from '@/utils/pointer_ndc.js';
import {
  ENTITY_HANDLE_ARROW_MIN_SCREEN_SHARE,
  ENTITY_HANDLE_ARROW_PIXELS,
  entityHandleArrowTipWorld,
} from '@/entity/handles/entity_handle_axis.js';

/** Distance in pixels from an arrow that still grabs it. */
const ENTITY_HANDLE_ARROW_PICK_PIXELS = 6;

/** Extra pixels around a ball that still grab it. */
const ENTITY_HANDLE_PICK_SLACK_PIXELS = 4;

/** A pane: its camera and the element it draws into. */
export interface EntityHandlePane {
  /** Camera of the pane. */
  camera: THREE.Camera;
  /** Element the pane draws into. */
  element: HTMLElement;
}

/** One arrow of a handle as a client-space segment. */
export interface EntityHandleArrowOnScreen {
  /** Handle the arrow belongs to. */
  readonly target: EntityHandleTarget;
  /** Unit world direction of the arrow. */
  readonly axis: THREE.Vector3;
  /** Client pixel of the handle. */
  readonly start: THREE.Vector2;
  /** Client pixel of the arrow tip. */
  readonly end: THREE.Vector2;
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

/** A grabbed handle: its ball, or one of its arrows. */
export interface EntityHandleGrab {
  /** Grabbed handle and owner. */
  readonly target: EntityHandleTarget;
  /** Unit world direction of the grabbed arrow, or null for the ball. */
  readonly axis: THREE.Vector3 | null;
}

/**
 * Returns the ball or arrow under the pointer: the nearest ball close enough to
 * grab, or else the nearest arrow close enough to grab.
 *
 * @param targets Shown handle targets.
 * @param pointer Pointer in a pane.
 * @returns Grab, or null when no ball or arrow is under the pointer.
 */
export function entityHandleGrabAt(
  targets: readonly EntityHandleTarget[],
  pointer: EntityHandlePointer,
): EntityHandleGrab | null {
  const ballTarget = entityHandleBallPickAt(targets, pointer);
  return ballTarget ? { target: ballTarget, axis: null } : entityHandleArrowPickAt(targets, pointer);
}

/**
 * Returns the handle whose ball is nearest to the pointer among those close
 * enough to grab.
 *
 * @param targets Shown handle targets.
 * @param pointer Pointer in a pane.
 * @returns Handle, or null when no ball is under the pointer.
 */
function entityHandleBallPickAt(
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
 * Returns the arrow nearest to the pointer among those close enough to grab.
 *
 * @param targets Shown handle targets.
 * @param pointer Pointer in a pane.
 * @returns Arrow grab, or null when no arrow is under the pointer.
 */
function entityHandleArrowPickAt(
  targets: readonly EntityHandleTarget[],
  pointer: EntityHandlePointer,
): EntityHandleGrab | null {
  const pointerPixel = new THREE.Vector2(pointer.event.clientX, pointer.event.clientY);
  let nearest: EntityHandleGrab | null = null;
  let nearestDistance = ENTITY_HANDLE_ARROW_PICK_PIXELS;
  for (const arrow of targets.flatMap((target) => entityHandleArrowsOnScreen(target, pointer))) {
    const distance = entityHandleSegmentDistance(pointerPixel, arrow.start, arrow.end);
    if (distance <= nearestDistance) {
      nearest = { target: arrow.target, axis: arrow.axis };
      nearestDistance = distance;
    }
  }
  return nearest;
}

/**
 * Returns the arrows of a handle as client-space segments, leaving out arrows
 * that point too far into the screen to grab.
 *
 * @param target Handle target.
 * @param pane Pane camera and element.
 * @returns Arrow segments with their direction.
 */
export function entityHandleArrowsOnScreen(
  target: EntityHandleTarget,
  pane: EntityHandlePane,
): EntityHandleArrowOnScreen[] {
  const settings = target.entityOwner.settingsRead(target.owner);
  const start = entityHandleClientPointOf(target, pane);
  if (settings === null || start === null) {
    return [];
  }
  const view = { owner: target.owner, camera: pane.camera };
  const origin = target.handle.worldPositionFor(view, settings);
  const rect = pane.element.getBoundingClientRect();
  return target.handle
    .axesFor(view, settings)
    .map((axis) => ({
      target,
      axis,
      start,
      end: entityHandleClientPixelOf(entityHandleArrowTipWorld(pane.camera, origin, axis, rect.height), pane),
    }))
    .filter(
      (arrow) => arrow.start.distanceTo(arrow.end) >= ENTITY_HANDLE_ARROW_PIXELS * ENTITY_HANDLE_ARROW_MIN_SCREEN_SHARE,
    );
}

/**
 * Returns the client pixel of a world point in a pane.
 *
 * @param world World point.
 * @param pane Pane camera and element.
 * @returns Client pixel.
 */
function entityHandleClientPixelOf(world: THREE.Vector3, pane: EntityHandlePane): THREE.Vector2 {
  const ndc = world.clone().project(pane.camera);
  const rect = pane.element.getBoundingClientRect();
  return new THREE.Vector2(rect.left + ((ndc.x + 1) / 2) * rect.width, rect.top + ((1 - ndc.y) / 2) * rect.height);
}

/**
 * Returns the distance from a point to a segment.
 *
 * @param point Point.
 * @param start Segment start.
 * @param end Segment end.
 * @returns Distance in the points' units.
 */
function entityHandleSegmentDistance(point: THREE.Vector2, start: THREE.Vector2, end: THREE.Vector2): number {
  const segment = end.clone().sub(start);
  const lengthSq = segment.lengthSq();
  const along = lengthSq > 0 ? THREE.MathUtils.clamp(point.clone().sub(start).dot(segment) / lengthSq, 0, 1) : 0;
  return point.distanceTo(start.clone().addScaledVector(segment, along));
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
