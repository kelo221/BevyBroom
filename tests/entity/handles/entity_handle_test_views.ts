import * as THREE from 'three';

/** A named camera looking at a point. */
export interface EntityHandleTestView {
  name: string;
  camera: THREE.Camera;
}

/**
 * Creates an orthographic camera looking at a target from a direction.
 *
 * @param target Point looked at.
 * @param fromDirection Unit direction from the target to the camera.
 * @param up Camera up direction.
 * @returns Camera with a current world matrix.
 */
function orthographicCreate(target: THREE.Vector3, fromDirection: THREE.Vector3, up: THREE.Vector3): THREE.Camera {
  const camera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 500);
  camera.up.copy(up);
  camera.position.copy(target).addScaledVector(fromDirection, 100);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * Creates the top, front and side orthographic views and an oblique perspective
 * view, all looking at a target.
 *
 * @param target Point every camera looks at.
 * @returns Named cameras.
 */
export function entityHandleTestViewsCreate(target: THREE.Vector3): EntityHandleTestView[] {
  const perspective = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  perspective.position.copy(target).add(new THREE.Vector3(7, 5, 9));
  perspective.lookAt(target);
  perspective.updateMatrixWorld(true);
  return [
    { name: 'top', camera: orthographicCreate(target, new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)) },
    { name: 'front', camera: orthographicCreate(target, new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)) },
    { name: 'side', camera: orthographicCreate(target, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)) },
    { name: 'perspective', camera: perspective },
  ];
}

/**
 * Returns the ray a camera casts through the pixel showing a world point.
 *
 * @param camera Viewing camera.
 * @param worldPoint Point under the pointer.
 * @returns World ray through the point.
 */
export function entityHandleTestRayToward(camera: THREE.Camera, worldPoint: THREE.Vector3): THREE.Ray {
  const ndc = worldPoint.clone().project(camera);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  return raycaster.ray.clone();
}
