import * as THREE from 'three';
import { DEFAULT_SPAWN_DISTANCE, isSpawnRaycastMesh } from '@/navigation/placement/object_spawn_placement.js';
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
  const ray = clipboardPlacementCursorRay(viewportPoint);
  if (viewportPoint.camera instanceof THREE.OrthographicCamera) {
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
    surfaceHit: clipboardPlacementSurfaceHitFind(ray, worldObject),
    workingPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    workingPlaneMaxDistance: CLIPBOARD_PLACEMENT_WORKING_PLANE_MAX_DISTANCE,
    fallbackDistance: DEFAULT_SPAWN_DISTANCE,
    gridInterval,
  });
}

/**
 * Builds the world ray through the pointer of a view.
 *
 * @param viewportPoint View and pointer position.
 * @returns World ray starting at the camera (or its near plane for orthographic
 *   cameras).
 */
function clipboardPlacementCursorRay(viewportPoint: ClipboardPlacementViewportPoint): THREE.Ray {
  const rect = viewportPoint.pickElement.getBoundingClientRect();
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);
  const pointer = new THREE.Vector2(
    ((viewportPoint.clientX - rect.left) / width) * 2 - 1,
    -((viewportPoint.clientY - rect.top) / height) * 2 + 1,
  );
  viewportPoint.camera.updateMatrixWorld();
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, viewportPoint.camera);
  return raycaster.ray.clone();
}

/**
 * Finds the nearest content surface along a ray.
 *
 * @param ray World ray.
 * @param worldObject World root whose content meshes the ray may hit.
 * @returns Hit point and world normal, or null when nothing is hit.
 */
function clipboardPlacementSurfaceHitFind(
  ray: THREE.Ray,
  worldObject: THREE.Object3D,
): ClipboardPlacementSurfaceHit | null {
  const targets: THREE.Mesh[] = [];
  worldObject.traverseVisible((object) => {
    if (isSpawnRaycastMesh(object, true)) targets.push(object);
  });
  const raycaster = new THREE.Raycaster(ray.origin, ray.direction);
  const hit = raycaster.intersectObjects(targets, false).find((candidate) => candidate.face);
  if (!hit?.face) {
    return null;
  }
  const normal = hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld));
  return { point: hit.point.clone(), normal: normal.normalize() };
}
