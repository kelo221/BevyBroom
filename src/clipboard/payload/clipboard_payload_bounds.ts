import * as THREE from 'three';
import type { ClipboardPayloadBounds } from '@/clipboard/payload/clipboard_payload_types.js';

/**
 * Measures the world-space bounds of objects and everything under them. When no
 * geometry contributes, the bounds enclose the objects' world positions.
 *
 * @param roots Objects to measure.
 * @returns World-space bounds.
 */
export function clipboardBoundsMeasure(roots: readonly THREE.Object3D[]): THREE.Box3 {
  const box = new THREE.Box3();
  roots.forEach((root) => {
    root.updateWorldMatrix(true, true);
    box.expandByObject(root);
  });
  if (!box.isEmpty()) {
    return box;
  }
  roots.forEach((root) => box.expandByPoint(root.getWorldPosition(new THREE.Vector3())));
  return box;
}

/**
 * Converts a box into payload bounds.
 *
 * @param box Non-empty box.
 * @returns Plain min and max corners.
 */
export function clipboardBoundsToPayload(box: THREE.Box3): ClipboardPayloadBounds {
  return {
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z },
  };
}

/**
 * Converts payload bounds into a box.
 *
 * @param bounds Plain min and max corners.
 * @returns New box.
 */
export function clipboardBoundsFromPayload(bounds: ClipboardPayloadBounds): THREE.Box3 {
  return new THREE.Box3(
    new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
    new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
  );
}
