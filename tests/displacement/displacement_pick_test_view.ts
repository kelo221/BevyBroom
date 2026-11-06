import * as THREE from 'three';

/** Side length, in pixels, of the fake viewport element. */
const PICK_TEST_VIEW_SIZE_PX = 200;

/** Camera, viewport element and centered pointer event aimed at a point. */
export interface DisplacementPickTestView {
  /** Camera looking at the target point. */
  camera: THREE.PerspectiveCamera;
  /** Element whose bounds define the pointer coordinates. */
  pickElement: HTMLElement;
  /** Pointer event at the center of the element. */
  event: MouseEvent;
}

/**
 * Builds a camera that looks at a point from along a direction and a pointer
 * event at the center of a fake viewport element, so a pick ray passes through
 * the point.
 *
 * @param target World point the ray must pass through.
 * @param from Direction from the target to the camera.
 * @param distance Camera distance from the target.
 * @returns Camera, element and event.
 */
export function displacementPickTestViewCreate(
  target: THREE.Vector3,
  from: THREE.Vector3,
  distance: number,
): DisplacementPickTestView {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
  camera.position.copy(target).addScaledVector(from.clone().normalize(), distance);
  camera.up.set(0, 0, -1);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  const pickElement = document.createElement('div');
  pickElement.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: PICK_TEST_VIEW_SIZE_PX,
      bottom: PICK_TEST_VIEW_SIZE_PX,
      width: PICK_TEST_VIEW_SIZE_PX,
      height: PICK_TEST_VIEW_SIZE_PX,
    }) as DOMRect;
  const center = PICK_TEST_VIEW_SIZE_PX / 2;
  const event = new MouseEvent('pointerdown', { clientX: center, clientY: center, buttons: 1 });
  return { camera, pickElement, event };
}
