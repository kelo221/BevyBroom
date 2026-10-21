import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { pointerClientPointOfWorld } from '@/utils/pointer_client_project.js';

/**
 * Creates an element whose bounding rectangle is fixed.
 *
 * @param rect Rectangle the element reports.
 * @returns Element with an overridden getBoundingClientRect.
 */
function elementWithRect(rect: DOMRect): HTMLElement {
  const element = document.createElement('div');
  element.getBoundingClientRect = () => rect;
  return element;
}

/**
 * Proves world points project to the client point over them, and that the
 * projection unprojects back onto the same camera ray.
 */
describe('pointerClientPointOfWorld', () => {
  const rect = new DOMRect(40, 25, 320, 200);

  it('maps the point the camera looks at to the center of the element', () => {
    const camera = new THREE.PerspectiveCamera(60, rect.width / rect.height, 0.1, 100);
    camera.position.set(3, 4, 5);
    const target = new THREE.Vector3(-1, 0.5, 2);
    camera.lookAt(target);
    const point = pointerClientPointOfWorld(target, camera, elementWithRect(rect));
    expect(point.clientX).toBeCloseTo(rect.left + rect.width / 2, 6);
    expect(point.clientY).toBeCloseTo(rect.top + rect.height / 2, 6);
  });

  it('gives a client point whose camera ray passes through the world point', () => {
    const camera = new THREE.PerspectiveCamera(50, rect.width / rect.height, 0.1, 100);
    camera.position.set(-2, 6, 7);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const worldPoint = new THREE.Vector3(1.5, 0.25, -0.75);
    const point = pointerClientPointOfWorld(worldPoint, camera, elementWithRect(rect));
    const ndc = new THREE.Vector2(
      ((point.clientX - rect.left) / rect.width) * 2 - 1,
      -((point.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    expect(raycaster.ray.distanceToPoint(worldPoint)).toBeLessThan(1e-6);
  });

  it('does not modify the world point', () => {
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    camera.position.set(0, 10, 0);
    camera.lookAt(0, 0, 0);
    const worldPoint = new THREE.Vector3(2, 0, -1);
    const copy = worldPoint.clone();
    pointerClientPointOfWorld(worldPoint, camera, elementWithRect(rect));
    expect(worldPoint.equals(copy)).toBe(true);
  });
});
