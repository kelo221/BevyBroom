import * as THREE from 'three';
import { worldSizeFromScreenPixels } from '@/transform/bounds/bounds_handle_screen_size.js';

/** Scratch viewport rectangle read from the renderer. */
const viewportScreenPixelViewportScratch = new THREE.Vector4();

/** Scratch camera position. */
const viewportScreenPixelCameraScratch = new THREE.Vector3();

/**
 * Converts a size in CSS pixels of the pane a renderer is drawing right now to
 * world units at a world point. Meant for `onBeforeRender` hooks that keep
 * overlay geometry a constant size on screen in every pane.
 *
 * @param renderer Renderer drawing the pane.
 * @param camera Camera of the pane.
 * @param point World point the size is measured at.
 * @param pixels Size in CSS pixels.
 * @returns World size.
 */
export function viewportScreenPixelWorldSize(
  renderer: THREE.WebGLRenderer,
  camera: THREE.Camera,
  point: THREE.Vector3,
  pixels: number,
): number {
  const viewportHeight = renderer.getViewport(viewportScreenPixelViewportScratch).w;
  const distance = point.distanceTo(camera.getWorldPosition(viewportScreenPixelCameraScratch));
  return worldSizeFromScreenPixels(camera, pixels, viewportHeight, distance);
}
