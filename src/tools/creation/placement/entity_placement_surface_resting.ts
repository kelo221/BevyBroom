import * as THREE from 'three';
import {
  clipboardPlacementAimOffsetCompute,
  type ClipboardPlacementAim,
  type ClipboardPlacementAimOptions,
} from '@/clipboard/placement/clipboard_placement_cursor.js';
import { EntityVisualBuilder } from '@/entity/visual/entity_visual_builder.js';

/**
 * Placement choices of entities rested on surfaces: views looking straight down
 * rest them too, and other entity markers never catch the aim.
 */
const ENTITY_PLACEMENT_SURFACE_RESTING_OPTIONS: ClipboardPlacementAimOptions = Object.freeze({
  isRestingInDownwardViews: true,
  isIgnoringEntityMarkers: true,
});

/**
 * Moves a new entity owner so its marker box rests on the surface under an aim,
 * with the owner origin snapped to the grid across the surface.
 *
 * @param owner New entity owner that is not yet in the world.
 * @param aim View camera and aimed screen point.
 * @param worldObject World root that will receive the owner; its meshes are the
 *   surfaces the owner may rest on.
 * @param gridInterval Grid step; zero or less disables snapping.
 */
export function entityPlacementSurfaceRestingApply(
  owner: THREE.Object3D,
  aim: ClipboardPlacementAim,
  worldObject: THREE.Object3D,
  gridInterval: number,
): void {
  owner.updateMatrixWorld(true);
  const bounds = entityPlacementSurfaceRestingBoundsOf(owner);
  const offset = clipboardPlacementAimOffsetCompute(
    aim,
    bounds,
    worldObject,
    gridInterval,
    ENTITY_PLACEMENT_SURFACE_RESTING_OPTIONS,
  );
  const worldTarget = owner.getWorldPosition(new THREE.Vector3()).add(offset);
  worldObject.updateMatrixWorld(true);
  owner.position.copy(worldObject.worldToLocal(worldTarget));
  owner.updateMatrixWorld(true);
}

/**
 * Returns the world bounds an owner rests with: its marker box, or the owner
 * origin when it has no marker.
 *
 * @param owner Entity owner with an updated world matrix.
 * @returns World bounds.
 */
function entityPlacementSurfaceRestingBoundsOf(owner: THREE.Object3D): THREE.Box3 {
  const marker = EntityVisualBuilder.markerFind(owner);
  if (marker === null) {
    const origin = owner.getWorldPosition(new THREE.Vector3());
    return new THREE.Box3(origin, origin.clone());
  }
  marker.geometry.computeBoundingBox();
  const localBounds = marker.geometry.boundingBox ?? new THREE.Box3();
  return localBounds.clone().applyMatrix4(marker.matrixWorld);
}
