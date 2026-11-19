import * as THREE from 'three';
import { DEFAULT_SPAWN_DISTANCE, isSpawnRaycastMesh } from '@/navigation/placement/object_spawn_placement.js';
import { ENTITY_PICK_MESH_USERDATA_KEY } from '@/entity/model/entity_owner_keys.js';
import {
  clipboardPlacementOffset2dCompute,
  clipboardPlacementOffset3dCompute,
  type ClipboardPlacementSurfaceHit,
} from '@/clipboard/placement/clipboard_placement_offset.js';

/** Farthest working grid plane hit used for a paste in a 3D view. */
const CLIPBOARD_PLACEMENT_WORKING_PLANE_MAX_DISTANCE = 200;

/** View and pointer a paste is placed under. */
export interface ClipboardPlacementViewportPoint {
  /** Camera of the view under the pointer. */
  readonly camera: THREE.Camera;
  /** Element the view draws into. */
  readonly pickElement: HTMLElement;
  /** Pointer client X. */
  readonly clientX: number;
  /** Pointer client Y. */
  readonly clientY: number;
}

/** Where placed content is aimed: a view camera and a point on its screen. */
export interface ClipboardPlacementAim {
  /** Camera of the view. */
  readonly camera: THREE.Camera;
  /** Aimed point in normalized device coordinates of the view (-1 to 1). */
  readonly ndc: THREE.Vector2;
}

/** Choices that differ between kinds of placement. */
export interface ClipboardPlacementAimOptions {
  /**
   * When true, orthographic views looking straight down rest content on the
   * surface or ground plane under the aim instead of keeping its depth.
   */
  readonly isRestingInDownwardViews: boolean;
  /** When true, the markers of entities never stop the aim ray. */
  readonly isIgnoringEntityMarkers?: boolean;
}

/** Placement choices of a clipboard paste: orthographic views keep the depth. */
export const CLIPBOARD_PLACEMENT_AIM_OPTIONS_PASTE: ClipboardPlacementAimOptions = Object.freeze({
  isRestingInDownwardViews: false,
});

/** Smallest downward share of a view direction that counts as looking down. */
const CLIPBOARD_PLACEMENT_DOWNWARD_VIEW_MIN = 0.9;

/**
 * Computes the offset that moves pasted content to the pointer of a view.
 * Orthographic views keep the content's depth; perspective views rest the
 * content on the surface or the ground grid plane under the pointer.
 *
 * @param viewportPoint View and pointer position.
 * @param bounds World bounds of the content at its copied position.
 * @param worldObject World root whose content meshes the ray may hit.
 * @param gridInterval Grid step the offset snaps to; zero disables snapping.
 * @returns World-space offset.
 */
export function clipboardPlacementCursorOffsetCompute(
  viewportPoint: ClipboardPlacementViewportPoint,
  bounds: THREE.Box3,
  worldObject: THREE.Object3D,
  gridInterval: number,
): THREE.Vector3 {
  const aim = clipboardPlacementAimFromViewportPoint(viewportPoint);
  return clipboardPlacementAimOffsetCompute(
    aim,
    bounds,
    worldObject,
    gridInterval,
    CLIPBOARD_PLACEMENT_AIM_OPTIONS_PASTE,
  );
}

/**
 * Computes the offset that moves content to an aimed point of a view. Content
 * rests on the surface or the ground grid plane under the aim, except in
 * orthographic views, which keep its depth unless the options rest it there in
 * views looking straight down.
 *
 * @param aim View camera and aimed screen point.
 * @param bounds World bounds of the content at its stored position.
 * @param worldObject World root whose content meshes the ray may hit.
 * @param gridInterval Grid step the offset snaps to; zero disables snapping.
 * @param options Placement choices.
 * @returns World-space offset.
 */
export function clipboardPlacementAimOffsetCompute(
  aim: ClipboardPlacementAim,
  bounds: THREE.Box3,
  worldObject: THREE.Object3D,
  gridInterval: number,
  options: ClipboardPlacementAimOptions,
): THREE.Vector3 {
  const ray = clipboardPlacementAimRay(aim);
  const isOrthographic = aim.camera instanceof THREE.OrthographicCamera;
  if (isOrthographic && !(options.isRestingInDownwardViews && clipboardPlacementRayLooksDown(ray))) {
    return clipboardPlacementOffset2dCompute({
      bounds,
      cursorPoint: ray.origin,
      viewDirection: ray.direction,
      gridInterval,
    });
  }
  return clipboardPlacementOffset3dCompute({
    bounds,
    ray,
    surfaceHit: clipboardPlacementSurfaceHitFind(ray, worldObject, options.isIgnoringEntityMarkers === true),
    workingPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    workingPlaneMaxDistance: isOrthographic ? Infinity : CLIPBOARD_PLACEMENT_WORKING_PLANE_MAX_DISTANCE,
    fallbackDistance: DEFAULT_SPAWN_DISTANCE,
    gridInterval,
  });
}

/**
 * Converts a pointer position over a view into an aim at that point.
 *
 * @param viewportPoint View and pointer position.
 * @returns Aim through the pointer.
 */
export function clipboardPlacementAimFromViewportPoint(
  viewportPoint: ClipboardPlacementViewportPoint,
): ClipboardPlacementAim {
  const rect = viewportPoint.pickElement.getBoundingClientRect();
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);
  const ndc = new THREE.Vector2(
    ((viewportPoint.clientX - rect.left) / width) * 2 - 1,
    -((viewportPoint.clientY - rect.top) / height) * 2 + 1,
  );
  return { camera: viewportPoint.camera, ndc };
}

/**
 * Builds the world ray of an aim.
 *
 * @param aim View camera and aimed screen point.
 * @returns World ray starting at the camera (or its near plane for orthographic
 *   cameras).
 */
function clipboardPlacementAimRay(aim: ClipboardPlacementAim): THREE.Ray {
  aim.camera.updateMatrixWorld();
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(aim.ndc, aim.camera);
  return raycaster.ray.clone();
}

/**
 * Returns whether a ray points straight down.
 *
 * @param ray World ray.
 * @returns True when the ray's direction is mostly downward.
 */
function clipboardPlacementRayLooksDown(ray: THREE.Ray): boolean {
  return ray.direction.y <= -CLIPBOARD_PLACEMENT_DOWNWARD_VIEW_MIN;
}

/**
 * Finds the nearest content surface along a ray.
 *
 * @param ray World ray.
 * @param worldObject World root whose content meshes the ray may hit.
 * @param isIgnoringEntityMarkers True when entity markers never stop the ray.
 * @returns Hit point and world normal, or null when nothing is hit.
 */
function clipboardPlacementSurfaceHitFind(
  ray: THREE.Ray,
  worldObject: THREE.Object3D,
  isIgnoringEntityMarkers: boolean,
): ClipboardPlacementSurfaceHit | null {
  const targets = clipboardPlacementSurfaceTargetsCollect(worldObject, isIgnoringEntityMarkers);
  const raycaster = new THREE.Raycaster(ray.origin, ray.direction);
  const hit = raycaster.intersectObjects(targets, false).find((candidate) => candidate.face);
  if (!hit?.face) {
    return null;
  }
  const normal = hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld));
  return { point: hit.point.clone(), normal: normal.normalize() };
}

/**
 * Collects the visible content meshes an aim ray may rest content on.
 *
 * @param worldObject World root whose content meshes are collected.
 * @param isIgnoringEntityMarkers True to leave out the markers of entities.
 * @returns Meshes the ray may hit.
 */
function clipboardPlacementSurfaceTargetsCollect(
  worldObject: THREE.Object3D,
  isIgnoringEntityMarkers: boolean,
): THREE.Mesh[] {
  const targets: THREE.Mesh[] = [];
  worldObject.traverseVisible((object) => {
    const isSkippedMarker = isIgnoringEntityMarkers && object.userData[ENTITY_PICK_MESH_USERDATA_KEY] === true;
    if (!isSkippedMarker && isSpawnRaycastMesh(object, true)) targets.push(object);
  });
  return targets;
}
