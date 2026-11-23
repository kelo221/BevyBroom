import * as THREE from 'three';
import { viewportScreenPixelWorldSize } from '@/viewports/scale/viewport_screen_pixel_size.js';

/**
 * Makes a preview object depth-tested in perspective panes, so geometry in
 * front of it hides it, and drawn on top in orthographic panes, where it must
 * read over the flat 2D wires.
 *
 * @param object Mesh or line drawn by the clip preview.
 */
export function clipPreviewDepthTestPerPaneApply(object: THREE.Object3D): void {
  object.onBeforeRender = (_renderer, _scene, camera, _geometry, material) => {
    material.depthTest = !(camera instanceof THREE.OrthographicCamera);
  };
}

/**
 * Keeps a preview object a constant size on screen in every pane: before each
 * draw it scales so one local unit spans the given number of CSS pixels at the
 * anchor point.
 *
 * @param object Object whose geometry is modeled around its own origin.
 * @param anchor World point the screen size is measured at.
 * @param pixelsPerUnit CSS pixels one local unit spans on screen.
 */
export function clipPreviewScreenConstantScaleApply(
  object: THREE.Object3D,
  anchor: THREE.Vector3,
  pixelsPerUnit: number,
): void {
  const anchorCopy = anchor.clone();
  object.frustumCulled = false;
  object.onBeforeRender = (renderer, _scene, camera) => {
    object.scale.setScalar(viewportScreenPixelWorldSize(renderer, camera, anchorCopy, pixelsPerUnit));
    object.updateMatrixWorld();
  };
}
