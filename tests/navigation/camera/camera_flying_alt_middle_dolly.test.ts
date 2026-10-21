import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CameraFlying } from '@/navigation/camera/camera_flying.js';
import { ManagerInput } from '@/input/manager_input.js';
import { managerPointerLock } from '@/input/manager_pointer_lock.js';

/** Middle mouse button index. */
const MIDDLE_BUTTON = 1;

/** Camera, controller and canvas used by one middle-drag scenario. */
interface MiddleDragRig {
  canvas: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  flyingCamera: CameraFlying;
  inputManager: ManagerInput;
}

/**
 * Builds a perspective camera that looks at a point away from the origin so the
 * view direction is not axis aligned.
 *
 * @returns Rig with a live flying camera controller.
 */
function middleDragRigCreate(): MiddleDragRig {
  const canvas = document.createElement('canvas');
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(3, 4, 5);
  camera.lookAt(new THREE.Vector3(-2, 1, -3));
  camera.updateMatrixWorld(true);
  const inputManager = new ManagerInput();
  const flyingCamera = new CameraFlying(canvas, camera, inputManager, 0, 0);
  flyingCamera.syncOrientationFromCamera();
  return { canvas, camera, flyingCamera, inputManager };
}

/**
 * Presses the middle button, drags vertically and releases it.
 *
 * @param rig Rig whose canvas receives the events.
 * @param movementY Vertical drag in CSS pixels; negative drags up.
 * @param altKey True when Alt is held during the drag.
 * @returns Camera position change caused by the drag.
 */
function middleDragApply(rig: MiddleDragRig, movementY: number, altKey: boolean): THREE.Vector3 {
  const before = rig.camera.position.clone();
  rig.canvas.dispatchEvent(new PointerEvent('pointerdown', { button: MIDDLE_BUTTON, pointerId: 1 }));
  rig.canvas.dispatchEvent(new PointerEvent('pointermove', { movementX: 0, movementY, altKey, pointerId: 1 }));
  rig.canvas.dispatchEvent(new PointerEvent('pointerup', { button: MIDDLE_BUTTON, pointerId: 1 }));
  return rig.camera.position.clone().sub(before);
}

/**
 * Returns the camera's current world view direction.
 *
 * @param camera Camera to read.
 * @returns Unit forward vector.
 */
function cameraForwardRead(camera: THREE.PerspectiveCamera): THREE.Vector3 {
  return camera.getWorldDirection(new THREE.Vector3());
}

/**
 * Releases the rig's listeners and input state.
 *
 * @param rig Rig to dispose.
 */
function middleDragRigDispose(rig: MiddleDragRig): void {
  rig.flyingCamera.dispose();
  rig.inputManager.dispose();
}

describe('CameraFlying Alt + middle mouse drag dolly', () => {
  afterEach(() => {
    managerPointerLock.reset();
  });

  it('moves the camera forward along its view when dragging up with Alt held', () => {
    const rig = middleDragRigCreate();
    rig.flyingCamera.setAltMiddleDragDolly(true, false);
    const forward = cameraForwardRead(rig.camera);
    const delta = middleDragApply(rig, -40, true);
    expect(delta.length()).toBeGreaterThan(1e-4);
    expect(delta.clone().normalize().dot(forward)).toBeCloseTo(1, 5);
    middleDragRigDispose(rig);
  });

  it('moves the camera backward for the same drag when the Z axis is inverted', () => {
    const rig = middleDragRigCreate();
    rig.flyingCamera.setAltMiddleDragDolly(true, true);
    const forward = cameraForwardRead(rig.camera);
    const delta = middleDragApply(rig, -40, true);
    expect(delta.clone().normalize().dot(forward)).toBeCloseTo(-1, 5);
    middleDragRigDispose(rig);
  });

  it('pans perpendicular to the view when the dolly setting is off', () => {
    const rig = middleDragRigCreate();
    const forward = cameraForwardRead(rig.camera);
    const delta = middleDragApply(rig, -40, true);
    expect(delta.length()).toBeGreaterThan(1e-4);
    expect(delta.clone().normalize().dot(forward)).toBeCloseTo(0, 5);
    middleDragRigDispose(rig);
  });

  it('pans perpendicular to the view without Alt even when the dolly setting is on', () => {
    const rig = middleDragRigCreate();
    rig.flyingCamera.setAltMiddleDragDolly(true, false);
    const forward = cameraForwardRead(rig.camera);
    const delta = middleDragApply(rig, -40, false);
    expect(delta.clone().normalize().dot(forward)).toBeCloseTo(0, 5);
    middleDragRigDispose(rig);
  });
});
