import * as THREE from 'three';

/** A point in window client coordinates. */
export interface PointerClientPoint {
  /** Client X in the owning window. */
  clientX: number;
  /** Client Y in the owning window. */
  clientY: number;
}

/**
 * Projects a world point through a camera onto a DOM element, giving the client
 * coordinates a pointer must have to sit over that point.
 *
 * @param worldPoint World position to project (not modified).
 * @param camera Camera that renders into the element.
 * @param element Element whose bounds define the view rectangle.
 * @returns Client point over the world position.
 */
export function pointerClientPointOfWorld(
  worldPoint: THREE.Vector3,
  camera: THREE.Camera,
  element: HTMLElement,
): PointerClientPoint {
  camera.updateMatrixWorld(false);
  const ndc = worldPoint.clone().project(camera);
  const rect = element.getBoundingClientRect();
  const width = Math.max(rect.width, 1);
  const height = Math.max(rect.height, 1);
  return {
    clientX: rect.left + ((ndc.x + 1) / 2) * width,
    clientY: rect.top + ((1 - ndc.y) / 2) * height,
  };
}
