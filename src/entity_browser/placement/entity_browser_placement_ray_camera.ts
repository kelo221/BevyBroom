import * as THREE from 'three';
import { pointerEventToNdc } from '@/utils/pointer_ndc.js';

/** Scratch raycaster reused to build view rays through client points. */
const entityBrowserPlacementRaycaster = new THREE.Raycaster();

/** Scratch normalized device coordinates of the client point. */
const entityBrowserPlacementNdc = new THREE.Vector2();

/**
 * Builds a camera that sits at the view ray origin under a client point and
 * looks along that ray, so placement code that spawns along a camera's view
 * direction places through the point instead of the view center.
 *
 * @param viewCamera Camera of the viewport under the point.
 * @param viewElement Element the viewport renders into.
 * @param clientX Client X of the point.
 * @param clientY Client Y of the point.
 * @returns Camera aligned with the view ray through the point.
 */
export function entityBrowserPlacementRayCameraCreate(
  viewCamera: THREE.Camera,
  viewElement: HTMLElement,
  clientX: number,
  clientY: number,
): THREE.PerspectiveCamera {
  pointerEventToNdc({ clientX, clientY }, viewElement, entityBrowserPlacementNdc);
  viewCamera.updateMatrixWorld(true);
  entityBrowserPlacementRaycaster.setFromCamera(entityBrowserPlacementNdc, viewCamera);
  const ray = entityBrowserPlacementRaycaster.ray;
  const rayCamera = new THREE.PerspectiveCamera();
  rayCamera.position.copy(ray.origin);
  rayCamera.lookAt(ray.origin.clone().add(ray.direction));
  rayCamera.updateMatrixWorld(true);
  return rayCamera;
}
