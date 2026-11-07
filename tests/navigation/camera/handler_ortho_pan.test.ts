import { afterEach, describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { HandlerOrthoPan, ORTHO_PAN_SPEED_FACTOR_DEFAULT } from '@/navigation/camera/handler_ortho_pan.js';
import { managerPointerLock } from '@/input/manager_pointer_lock.js';

/** Canvas, camera and handler used by one pan scenario. */
interface OrthoPanRig {
  canvas: HTMLCanvasElement;
  camera: THREE.OrthographicCamera;
  handler: HandlerOrthoPan;
}

/**
 * Builds a sized canvas and a tilted orthographic camera with a pan handler.
 *
 * @returns Rig ready to receive pointer events.
 */
function orthoPanRigCreate(): OrthoPanRig {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'clientWidth', { value: 800, configurable: true });
  Object.defineProperty(canvas, 'clientHeight', { value: 600, configurable: true });
  const camera = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 1000);
  camera.position.set(2, 30, 1);
  camera.up.set(0, 0, -1);
  camera.lookAt(new THREE.Vector3(2, 0, 1));
  camera.updateMatrixWorld(true);
  const handler = new HandlerOrthoPan(canvas, camera, vi.fn());
  return { canvas, camera, handler };
}

/** PointerEvent.buttons bit for each mouse button index used by pan. */
const ORTHO_PAN_TEST_BUTTON_MASKS: Readonly<Record<number, number>> = { 1: 4, 2: 2 };

/**
 * Presses one button, drags diagonally with it held and releases it.
 *
 * @param rig Rig whose canvas receives the events.
 * @param button Mouse button index to drag with.
 */
function orthoPanDragApply(rig: OrthoPanRig, button: number): void {
  const buttons = ORTHO_PAN_TEST_BUTTON_MASKS[button] ?? 0;
  rig.canvas.dispatchEvent(new PointerEvent('pointerdown', { button, buttons, pointerId: 1 }));
  rig.canvas.dispatchEvent(new PointerEvent('pointermove', { movementX: 15, movementY: -7, buttons, pointerId: 1 }));
  rig.canvas.dispatchEvent(new PointerEvent('pointerup', { button, pointerId: 1 }));
}

/**
 * Drags the rig with the right button and returns how far the camera moved.
 *
 * @param rig Rig whose canvas receives the drag.
 * @returns Camera travel distance in world units.
 */
function orthoPanRightDragDistance(rig: OrthoPanRig): number {
  const before = rig.camera.position.clone();
  orthoPanDragApply(rig, 2);
  return rig.camera.position.distanceTo(before);
}

describe('OrthoPanHandler', () => {
  afterEach(() => {
    managerPointerLock.reset();
    Object.defineProperty(document, 'pointerLockElement', {
      configurable: true,
      value: null,
    });
  });

  it('starts pan from a delayed Face Select drag and stops on release', () => {
    const canvas = document.createElement('canvas');
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000);
    const handler = new HandlerOrthoPan(canvas, camera, vi.fn());
    expect(handler.isNavigating()).toBe(false);
    handler.beginSecondaryButtonPan(new PointerEvent('pointermove', { pointerId: 1, button: 2 }));
    expect(handler.isNavigating()).toBe(true);
    canvas.dispatchEvent(new PointerEvent('pointerup', { button: 2, pointerId: 1 }));
    expect(handler.isNavigating()).toBe(false);
    handler.dispose();
  });

  it('should set and clear pan state on right click', () => {
    const canvas = document.createElement('canvas');
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000);
    const zoomCallback = vi.fn();
    const handler = new HandlerOrthoPan(canvas, camera, zoomCallback);
    let moveHandled = 0;
    canvas.addEventListener('pointermove', () => {
      moveHandled++;
    });
    expect(handler.isNavigating()).toBe(false);
    canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 2, pointerId: 1 }));
    expect(handler.isNavigating()).toBe(true);
    canvas.dispatchEvent(new PointerEvent('pointermove', { button: 0, pointerId: 1 }));
    expect(moveHandled).toBe(1);
    canvas.dispatchEvent(new PointerEvent('pointerup', { button: 2, pointerId: 1 }));
    expect(handler.isNavigating()).toBe(false);
  });

  it('should trigger zoom callback on wheel event with pointer fractions', () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      value: () => ({ left: 100, top: 50, width: 200, height: 100, right: 300, bottom: 150 }),
    });
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000);
    const zoomCallback = vi.fn();
    new HandlerOrthoPan(canvas, camera, zoomCallback);
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, clientX: 150, clientY: 100 }));
    expect(zoomCallback).toHaveBeenCalled();
    const [factor, pointerU, pointerV] = zoomCallback.mock.calls[0] as [number, number, number];
    expect(factor).toBeGreaterThan(1);
    expect(pointerU).toBeCloseTo(0.25);
    expect(pointerV).toBeCloseTo(0.5);
  });

  it('should attempt pointer lock on right button down', () => {
    const canvas = document.createElement('canvas');
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000);
    const zoomCallback = vi.fn();
    const lockSpy = vi.fn();
    (canvas as any).requestPointerLock = lockSpy;
    new HandlerOrthoPan(canvas, camera, zoomCallback);
    canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 2, pointerId: 1 }));
    expect(lockSpy).toHaveBeenCalled();
  });

  it('should exit pointer lock on right button up', () => {
    const canvas = document.createElement('canvas');
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000);
    const zoomCallback = vi.fn();
    (canvas as any).requestPointerLock = () => {
      Object.defineProperty(document, 'pointerLockElement', { value: canvas, configurable: true });
      document.dispatchEvent(new Event('pointerlockchange'));
    };
    const exitLockSpy = vi.fn(() => {
      Object.defineProperty(document, 'pointerLockElement', { value: null, configurable: true });
      document.dispatchEvent(new Event('pointerlockchange'));
    });
    (document as any).exitPointerLock = exitLockSpy;
    new HandlerOrthoPan(canvas, camera, zoomCallback);
    canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 2, pointerId: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { button: 2, pointerId: 1 }));
    expect(exitLockSpy).toHaveBeenCalled();
  });

  it('pans along the camera right and up axes with a middle mouse drag', () => {
    const rig = orthoPanRigCreate();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(rig.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rig.camera.quaternion);
    const before = rig.camera.position.clone();
    rig.canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 1, pointerId: 1, cancelable: true }));
    rig.canvas.dispatchEvent(new PointerEvent('pointermove', { movementX: 20, movementY: 10, pointerId: 1 }));
    const delta = rig.camera.position.clone().sub(before);
    expect(delta.dot(right)).toBeLessThan(-1e-4);
    expect(delta.dot(up)).toBeGreaterThan(1e-4);
    expect(rig.handler.isNavigating()).toBe(true);
    rig.canvas.dispatchEvent(new PointerEvent('pointerup', { button: 1, pointerId: 1 }));
    expect(rig.handler.isNavigating()).toBe(false);
  });

  it('moves the camera the same way for a middle drag and a right drag', () => {
    const middleRig = orthoPanRigCreate();
    const rightRig = orthoPanRigCreate();
    const start = middleRig.camera.position.clone();
    orthoPanDragApply(middleRig, 1);
    orthoPanDragApply(rightRig, 2);
    expect(middleRig.camera.position.distanceTo(start)).toBeGreaterThan(1e-4);
    expect(middleRig.camera.position.distanceTo(rightRig.camera.position)).toBeLessThan(1e-9);
  });

  it('keeps panning until both pan buttons are released', () => {
    const rig = orthoPanRigCreate();
    rig.canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 1, pointerId: 1 }));
    rig.canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 2, pointerId: 1 }));
    rig.canvas.dispatchEvent(new PointerEvent('pointerup', { button: 1, pointerId: 1 }));
    expect(rig.handler.isNavigating()).toBe(true);
    rig.canvas.dispatchEvent(new PointerEvent('pointerup', { button: 2, pointerId: 1 }));
    expect(rig.handler.isNavigating()).toBe(false);
  });

  it('stops a middle pan when the release arrives as a document mouseup', () => {
    const rig = orthoPanRigCreate();
    rig.canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 1, pointerId: 1 }));
    document.dispatchEvent(new MouseEvent('mouseup', { button: 1 }));
    expect(rig.handler.isNavigating()).toBe(false);
  });

  it('cancels the browser default for middle presses and middle clicks', () => {
    const rig = orthoPanRigCreate();
    const press = new PointerEvent('pointerdown', { button: 1, pointerId: 1, cancelable: true });
    const click = new MouseEvent('auxclick', { button: 1, cancelable: true });
    rig.canvas.dispatchEvent(press);
    rig.canvas.dispatchEvent(click);
    expect(press.defaultPrevented).toBe(true);
    expect(click.defaultPrevented).toBe(true);
  });

  it('ignores left button presses', () => {
    const rig = orthoPanRigCreate();
    rig.canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerId: 1 }));
    expect(rig.handler.isNavigating()).toBe(false);
  });

  it('should stop panning when pointer lock is lost externally', () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(canvas, 'clientHeight', { value: 600, configurable: true });
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 1000);
    camera.position.set(0, 0, 10);
    const zoomCallback = vi.fn();
    (canvas as any).requestPointerLock = () => {
      Object.defineProperty(document, 'pointerLockElement', { value: canvas, configurable: true });
    };
    new HandlerOrthoPan(canvas, camera, zoomCallback);
    canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 2, buttons: 2, pointerId: 1 }));
    const initialPosition = camera.position.clone();
    canvas.dispatchEvent(new PointerEvent('pointermove', { movementX: 10, movementY: 0, buttons: 2, pointerId: 1 }));
    expect(camera.position.distanceTo(initialPosition)).toBeGreaterThan(0.001);
    Object.defineProperty(document, 'pointerLockElement', { value: null, configurable: true });
    document.dispatchEvent(new Event('pointerlockchange'));
    const positionAfterLockLoss = camera.position.clone();
    canvas.dispatchEvent(new PointerEvent('pointermove', { movementX: 10, movementY: 0, buttons: 2, pointerId: 1 }));
    expect(camera.position.distanceTo(positionAfterLockLoss)).toBeLessThan(0.001);
  });

  it('pans half as far at the default speed factor as at full speed', () => {
    const defaultRig = orthoPanRigCreate();
    const fullSpeedRig = orthoPanRigCreate();
    fullSpeedRig.handler.setPanSpeedFactor(1);
    const defaultDistance = orthoPanRightDragDistance(defaultRig);
    const fullSpeedDistance = orthoPanRightDragDistance(fullSpeedRig);
    expect(fullSpeedDistance).toBeGreaterThan(1e-4);
    expect(ORTHO_PAN_SPEED_FACTOR_DEFAULT).toBe(0.5);
    expect(defaultDistance).toBeCloseTo(fullSpeedDistance * ORTHO_PAN_SPEED_FACTOR_DEFAULT, 9);
  });

  it('scales the pan distance linearly with the speed factor and ignores invalid factors', () => {
    const quarterRig = orthoPanRigCreate();
    const fullSpeedRig = orthoPanRigCreate();
    quarterRig.handler.setPanSpeedFactor(0.25);
    quarterRig.handler.setPanSpeedFactor(Number.NaN);
    quarterRig.handler.setPanSpeedFactor(-1);
    fullSpeedRig.handler.setPanSpeedFactor(1);
    expect(orthoPanRightDragDistance(quarterRig)).toBeCloseTo(orthoPanRightDragDistance(fullSpeedRig) * 0.25, 9);
  });

  it('keeps a middle-button pan when the right button bit is clear', () => {
    const rig = orthoPanRigCreate();
    rig.canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 1, buttons: 4, pointerId: 1 }));
    rig.canvas.dispatchEvent(new PointerEvent('pointermove', { movementX: 4, buttons: 4, pointerId: 1 }));
    expect(rig.handler.isNavigating()).toBe(true);
  });

  it('keeps a right-button pan through moves and capture losses that report no buttons until the release', () => {
    const rig = orthoPanRigCreate();
    rig.canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 2, buttons: 2, pointerId: 1 }));
    rig.canvas.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 1, buttons: 0 }));
    rig.canvas.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, buttons: 0 }));
    expect(rig.handler.isNavigating()).toBe(true);
    rig.canvas.dispatchEvent(new PointerEvent('pointerup', { button: 2, buttons: 0, pointerId: 1 }));
    expect(rig.handler.isNavigating()).toBe(false);
  });
});
