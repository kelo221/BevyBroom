import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { PerspectiveCameraAnimator } from '@/navigation/camera/perspective_camera_animator.js';
import { CameraAnimationConfig } from '@/navigation/camera/camera_animation_config.js';

describe('PerspectiveCameraAnimator', () => {
  let animator: PerspectiveCameraAnimator;
  let config: CameraAnimationConfig;
  let camera: THREE.PerspectiveCamera;
  let mockTime: number;

  beforeEach(() => {
    mockTime = 0;
    vi.stubGlobal('performance', {
      now: () => mockTime,
    });
    animator = new PerspectiveCameraAnimator();
    config = new CameraAnimationConfig();
    config.setDurationMs(100);
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should start in idle state', () => {
    expect(animator.isAnimating()).toBe(false);
  });

  it('should start animation when animateToTarget is called', () => {
    config.setAnimationEnabled(true);
    const result = animator.animateToTarget(camera, new THREE.Vector3(10, 10, 10), new THREE.Vector3(0, 0, 0), config);
    expect(result).toBe(true);
    expect(animator.isAnimating()).toBe(true);
  });

  it('should complete animation on update calls', () => {
    config.setAnimationEnabled(true);
    animator.animateToTarget(camera, new THREE.Vector3(10, 10, 10), new THREE.Vector3(0, 0, 0), config);
    mockTime += 200;
    const stillRunning = animator.update();
    expect(stillRunning).toBe(false);
    expect(animator.isAnimating()).toBe(false);
  });

  it('should snap instantly when animation is disabled', () => {
    config.setAnimationEnabled(false);
    const result = animator.animateToTarget(camera, new THREE.Vector3(10, 10, 10), new THREE.Vector3(0, 0, 0), config);
    expect(result).toBe(false);
    expect(animator.isAnimating()).toBe(false);
    expect(camera.position.x).toBeCloseTo(10);
    expect(camera.position.y).toBeCloseTo(10);
    expect(camera.position.z).toBeCloseTo(10);
  });

  it('should move camera position toward target during animation', () => {
    config.setAnimationEnabled(true);
    const startPosition = camera.position.clone();
    animator.animateToTarget(camera, new THREE.Vector3(20, 20, 20), new THREE.Vector3(0, 0, 0), config);
    mockTime += 50;
    animator.update();
    const distanceFromStart = camera.position.distanceTo(startPosition);
    expect(distanceFromStart).toBeGreaterThan(0);
  });

  it('should cancel animation and snap to interpolated state', () => {
    config.setAnimationEnabled(true);
    const targetPosition = new THREE.Vector3(20, 20, 20);
    animator.animateToTarget(camera, targetPosition, new THREE.Vector3(0, 0, 0), config);
    mockTime += 50;
    animator.cancel();
    expect(animator.isAnimating()).toBe(false);
  });

  it('should return false on update when not animating', () => {
    const result = animator.update();
    expect(result).toBe(false);
  });

  it('should return false on cancel when not animating', () => {
    animator.cancel();
    expect(animator.isAnimating()).toBe(false);
  });

  it('should reach target position after full animation duration', () => {
    config.setAnimationEnabled(true);
    const targetPosition = new THREE.Vector3(15, 15, 15);
    animator.animateToTarget(camera, targetPosition, new THREE.Vector3(0, 0, 0), config);
    mockTime += 200;
    animator.update();
    expect(camera.position.x).toBeCloseTo(15, 1);
    expect(camera.position.y).toBeCloseTo(15, 1);
    expect(camera.position.z).toBeCloseTo(15, 1);
  });

  it('should not throw on update after animation completes', () => {
    config.setAnimationEnabled(true);
    animator.animateToTarget(camera, new THREE.Vector3(10, 10, 10), new THREE.Vector3(0, 0, 0), config);
    mockTime += 200;
    animator.update();
    expect(() => animator.update()).not.toThrow();
  });

  /**
   * Framing a point beside the camera while the camera moves past its old view
   * line must turn the view smoothly: no frame may jump by a large angle.
   */
  it('turns without jumps when the camera moves through its old line of sight', () => {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const targetLookAt = camera.position.clone().addScaledVector(right, 5);
    const targetPosition = camera.position.clone().addScaledVector(right, 5).addScaledVector(forward, 5);
    animator.animateToTarget(camera, targetPosition, targetLookAt, config);
    const previousForward = forward.clone();
    const currentForward = new THREE.Vector3();
    let largestStep = 0;
    for (let frame = 1; frame <= 100; frame += 1) {
      mockTime = frame;
      animator.update();
      camera.getWorldDirection(currentForward);
      largestStep = Math.max(largestStep, currentForward.angleTo(previousForward));
      previousForward.copy(currentForward);
    }
    expect(largestStep).toBeLessThan(0.1);
  });

  /** The turn eases along the way and ends exactly on the target view. */
  it('turns gradually and ends looking at the target look-at point', () => {
    const targetPosition = new THREE.Vector3(10, 2, 0);
    const targetLookAt = new THREE.Vector3(10, 2, -10);
    const expectedForward = targetLookAt.clone().sub(targetPosition).normalize();
    const startForward = camera.getWorldDirection(new THREE.Vector3());
    animator.animateToTarget(camera, targetPosition, targetLookAt, config);
    mockTime = 30;
    animator.update();
    const midForward = camera.getWorldDirection(new THREE.Vector3());
    expect(midForward.angleTo(expectedForward)).toBeLessThan(startForward.angleTo(expectedForward) + 1e-6);
    mockTime = 100;
    animator.update();
    expect(camera.getWorldDirection(new THREE.Vector3()).angleTo(expectedForward)).toBeLessThan(1e-4);
    expect(camera.position.distanceTo(targetPosition)).toBeLessThan(1e-6);
  });
});
