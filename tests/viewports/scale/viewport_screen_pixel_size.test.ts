import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { viewportScreenPixelWorldSize } from '@/viewports/scale/viewport_screen_pixel_size.js';

/**
 * Builds a renderer stub drawing a pane of the given height.
 *
 * @param heightPixels Pane height in CSS pixels.
 * @returns Renderer stub.
 */
function paneRendererCreate(heightPixels: number): THREE.WebGLRenderer {
  return {
    getViewport: (target: THREE.Vector4) => target.set(0, 0, heightPixels * 2, heightPixels),
  } as unknown as THREE.WebGLRenderer;
}

/**
 * Proves the pixel-to-world conversion used by screen-constant overlays: it
 * follows the pane height, the orthographic frustum and the perspective
 * distance of the point.
 */
describe('viewportScreenPixelWorldSize', () => {
  it('uses the orthographic frustum height over the pane height', () => {
    const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
    const size = viewportScreenPixelWorldSize(paneRendererCreate(200), camera, new THREE.Vector3(), 10);
    expect(size).toBeCloseTo((8 / 200) * 10, 9);
  });

  it('grows linearly with the distance of the point in perspective panes', () => {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(0, 0, 0);
    camera.updateMatrixWorld(true);
    const renderer = paneRendererCreate(300);
    const near = viewportScreenPixelWorldSize(renderer, camera, new THREE.Vector3(0, 0, -5), 8);
    const far = viewportScreenPixelWorldSize(renderer, camera, new THREE.Vector3(0, 0, -20), 8);
    expect(far / near).toBeCloseTo(4, 6);
    const viewHeightAtNear = 2 * 5 * Math.tan(THREE.MathUtils.degToRad(30));
    expect(near).toBeCloseTo((viewHeightAtNear / 300) * 8, 9);
  });

  it('halves the world size when the pane is twice as tall', () => {
    const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
    const small = viewportScreenPixelWorldSize(paneRendererCreate(200), camera, new THREE.Vector3(), 10);
    const tall = viewportScreenPixelWorldSize(paneRendererCreate(400), camera, new THREE.Vector3(), 10);
    expect(tall).toBeCloseTo(small / 2, 9);
  });
});
