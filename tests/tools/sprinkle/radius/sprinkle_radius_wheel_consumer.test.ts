import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { HandlerOrthoPan } from '@/navigation/camera/handler_ortho_pan.js';
import { CameraFlying } from '@/navigation/camera/camera_flying.js';
import type { ManagerInput } from '@/input/manager_input.js';
import { managerPointerLock } from '@/input/manager_pointer_lock.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { SPRINKLE_RADIUS_MAX, SPRINKLE_RADIUS_MIN } from '@/tools/sprinkle/sprinkle_types.js';
import {
  SPRINKLE_RADIUS_WHEEL_NOTCH_DOUBLINGS,
  sprinkleRadiusWheelConsumerInstall,
} from '@/tools/sprinkle/radius/sprinkle_radius_wheel_consumer.js';

/** 2D view canvas, zoom spy and pan handler. */
interface SprinkleWheelOrthoRig {
  canvas: HTMLCanvasElement;
  zoom: ReturnType<typeof vi.fn>;
  handler: HandlerOrthoPan;
}

/** 3D view canvas, camera and flying controller. */
interface SprinkleWheelPerspectiveRig {
  canvas: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  flyingCamera: CameraFlying;
}

/** Disposers of the running test. */
const sprinkleWheelTestDisposers: Array<() => void> = [];

/**
 * Builds a 2D view whose wheel zoom is recorded.
 *
 * @returns 2D rig.
 */
function sprinkleWheelOrthoRigCreate(): SprinkleWheelOrthoRig {
  const canvas = document.createElement('canvas');
  const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 100);
  const zoom = vi.fn();
  const handler = new HandlerOrthoPan(canvas, camera, zoom);
  sprinkleWheelTestDisposers.push(() => handler.dispose());
  return { canvas, zoom, handler };
}

/**
 * Builds a 3D view whose camera dollies on plain wheel turns.
 *
 * @returns 3D rig.
 */
function sprinkleWheelPerspectiveRigCreate(): SprinkleWheelPerspectiveRig {
  const idleInputManager = { isKeyDown: () => false, isPhysicalKeyDown: () => false, isShiftDown: () => false };
  const canvas = document.createElement('canvas');
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  const flyingCamera = new CameraFlying(canvas, camera, idleInputManager as unknown as ManagerInput, 0, 0);
  sprinkleWheelTestDisposers.push(() => flyingCamera.dispose());
  return { canvas, camera, flyingCamera };
}

/**
 * Turns the wheel one notch over a canvas.
 *
 * @param canvas View canvas.
 * @param deltaY Wheel delta; negative turns up, away from the user.
 * @param altKey Whether Alt is held.
 * @returns The dispatched event.
 */
function sprinkleWheelTurn(canvas: HTMLCanvasElement, deltaY: number, altKey: boolean): WheelEvent {
  const event = new WheelEvent('wheel', { deltaY, altKey, cancelable: true });
  canvas.dispatchEvent(event);
  return event;
}

/**
 * Returns the configured Sprinkle radius.
 *
 * @returns Radius in meters.
 */
function sprinkleRadiusRead(): number {
  return getStateSprinkleTool().configRead().radius;
}

/** Alt+wheel Sprinkle radius steps over 2D and 3D views. */
describe('sprinkleRadiusWheelConsumer', () => {
  beforeEach(() => {
    sprinkleWheelTestDisposers.push(sprinkleRadiusWheelConsumerInstall());
    getStateSprinkleTool().toolActiveWrite(true);
  });

  afterEach(() => {
    sprinkleWheelTestDisposers.splice(0).forEach((dispose) => dispose());
    getStateSprinkleTool().reset();
    managerPointerLock.reset();
  });

  it('grows the radius on Alt+wheel up and shrinks it on Alt+wheel down in a 2D view without zooming', () => {
    const rig = sprinkleWheelOrthoRigCreate();
    const radiusBefore = sprinkleRadiusRead();
    const upTurn = sprinkleWheelTurn(rig.canvas, -1, true);
    expect(sprinkleRadiusRead()).toBeCloseTo(radiusBefore * Math.pow(2, SPRINKLE_RADIUS_WHEEL_NOTCH_DOUBLINGS), 9);
    sprinkleWheelTurn(rig.canvas, 1, true);
    sprinkleWheelTurn(rig.canvas, 1, true);
    expect(sprinkleRadiusRead()).toBeCloseTo(radiusBefore * Math.pow(2, -SPRINKLE_RADIUS_WHEEL_NOTCH_DOUBLINGS), 9);
    expect(upTurn.defaultPrevented).toBe(true);
    expect(rig.zoom).not.toHaveBeenCalled();
  });

  it('resizes on Alt+wheel in the 3D view and leaves the camera in place', () => {
    const rig = sprinkleWheelPerspectiveRigCreate();
    const positionBefore = rig.camera.position.clone();
    const radiusBefore = sprinkleRadiusRead();
    sprinkleWheelTurn(rig.canvas, -1, true);
    expect(sprinkleRadiusRead()).toBeGreaterThan(radiusBefore);
    expect(rig.camera.position.distanceTo(positionBefore)).toBe(0);
  });

  it('steps the fly speed instead of the radius on Alt+wheel during right-button fly look', () => {
    const rig = sprinkleWheelPerspectiveRigCreate();
    rig.canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 2, buttons: 2, pointerId: 1 }));
    const speedBefore = rig.flyingCamera.getMoveSpeed();
    const radiusBefore = sprinkleRadiusRead();
    const turn = sprinkleWheelTurn(rig.canvas, -1, true);
    rig.canvas.dispatchEvent(new PointerEvent('pointerup', { button: 2, buttons: 0, pointerId: 1 }));
    expect(rig.flyingCamera.getMoveSpeed()).toBeGreaterThan(speedBefore);
    expect(sprinkleRadiusRead()).toBe(radiusBefore);
    expect(turn.defaultPrevented).toBe(true);
  });

  it('leaves no Alt release listener behind once uninstalled', () => {
    const rig = sprinkleWheelOrthoRigCreate();
    sprinkleWheelTurn(rig.canvas, -1, true);
    sprinkleWheelTestDisposers.splice(0, 1).forEach((uninstall) => uninstall());
    const altRelease = new KeyboardEvent('keyup', { key: 'Alt', code: 'AltLeft', cancelable: true });
    window.dispatchEvent(altRelease);
    expect(altRelease.defaultPrevented).toBe(false);
  });

  it('clamps the radius to the Sprinkle range and still keeps the turn from the camera', () => {
    const rig = sprinkleWheelOrthoRigCreate();
    getStateSprinkleTool().configPatch({ radius: SPRINKLE_RADIUS_MAX });
    sprinkleWheelTurn(rig.canvas, -1, true);
    expect(sprinkleRadiusRead()).toBe(SPRINKLE_RADIUS_MAX);
    getStateSprinkleTool().configPatch({ radius: SPRINKLE_RADIUS_MIN });
    sprinkleWheelTurn(rig.canvas, 1, true);
    expect(sprinkleRadiusRead()).toBe(SPRINKLE_RADIUS_MIN);
    expect(rig.zoom).not.toHaveBeenCalled();
  });

  it('leaves plain wheel turns to zooming and dollying', () => {
    const orthoRig = sprinkleWheelOrthoRigCreate();
    const perspectiveRig = sprinkleWheelPerspectiveRigCreate();
    const radiusBefore = sprinkleRadiusRead();
    const positionBefore = perspectiveRig.camera.position.clone();
    sprinkleWheelTurn(orthoRig.canvas, -1, false);
    sprinkleWheelTurn(perspectiveRig.canvas, -1, false);
    expect(orthoRig.zoom).toHaveBeenCalledOnce();
    expect(perspectiveRig.camera.position.distanceTo(positionBefore)).toBeGreaterThan(0);
    expect(sprinkleRadiusRead()).toBe(radiusBefore);
  });

  it('ignores Alt+wheel while the Sprinkle tool is inactive so the view zooms', () => {
    const rig = sprinkleWheelOrthoRigCreate();
    getStateSprinkleTool().toolActiveWrite(false);
    const radiusBefore = sprinkleRadiusRead();
    sprinkleWheelTurn(rig.canvas, -1, true);
    expect(sprinkleRadiusRead()).toBe(radiusBefore);
    expect(rig.zoom).toHaveBeenCalledOnce();
  });

  it('stops resizing once uninstalled', () => {
    const rig = sprinkleWheelOrthoRigCreate();
    sprinkleWheelTestDisposers.splice(0, 1).forEach((uninstall) => uninstall());
    const radiusBefore = sprinkleRadiusRead();
    sprinkleWheelTurn(rig.canvas, -1, true);
    expect(sprinkleRadiusRead()).toBe(radiusBefore);
    expect(rig.zoom).toHaveBeenCalledOnce();
  });
});
