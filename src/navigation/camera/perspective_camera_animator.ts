import * as THREE from 'three';
import { easeOutCubic } from '@/utils/easing.js';
import { CameraAnimationConfig } from './camera_animation_config.js';

/**
 * Smoothly animates a perspective camera from its current position to a target
 * position and look-at point using ease-out cubic interpolation: the position
 * moves along a straight line and the orientation turns along the shortest
 * arc.
 */
export class PerspectiveCameraAnimator {
  private camera: THREE.PerspectiveCamera;
  private startPosition: THREE.Vector3;
  private startOrientation: THREE.Quaternion;
  private targetPosition: THREE.Vector3;
  private targetLookAt: THREE.Vector3;
  private targetOrientation: THREE.Quaternion;
  private startTime: number;
  private duration: number;
  private animationActive: boolean;

  /** Creates a new perspective camera animator in an idle state. */
  constructor() {
    this.camera = null as unknown as THREE.PerspectiveCamera;
    this.startPosition = new THREE.Vector3();
    this.startOrientation = new THREE.Quaternion();
    this.targetPosition = new THREE.Vector3();
    this.targetLookAt = new THREE.Vector3();
    this.targetOrientation = new THREE.Quaternion();
    this.startTime = 0;
    this.duration = 300;
    this.animationActive = false;
  }

  /**
   * Starts a new animation to smoothly move the camera to the target state.
   *
   * @param camera The perspective camera to animate.
   * @param targetPosition The destination camera position.
   * @param targetLookAt The destination look-at point.
   * @param config Configuration controlling animation timing.
   * @returns True if the animation was successfully started.
   */
  animateToTarget(
    camera: THREE.PerspectiveCamera,
    targetPosition: THREE.Vector3,
    targetLookAt: THREE.Vector3,
    config: CameraAnimationConfig,
  ): boolean {
    this.camera = camera;
    this.startPosition.copy(camera.position);
    this.startOrientation.copy(camera.quaternion);
    this.targetPosition.copy(targetPosition);
    this.targetLookAt.copy(targetLookAt);
    this.targetOrientationCompute(camera);
    this.startTime = performance.now();
    this.duration = config.getDurationMs();

    if (!config.isAnimationEnabled()) {
      this.snapToTarget();
      return false;
    }

    this.animationActive = true;
    return true;
  }

  /**
   * Advances the animation by one frame using the current time. Updates camera
   * position and orientation if still in progress.
   *
   * @returns True if the animation is still running, false if complete.
   */
  update(): boolean {
    if (!this.animationActive) return false;
    const now = performance.now();
    const elapsed = now - this.startTime;
    const rawT = Math.min(elapsed / this.duration, 1);
    const easedT = easeOutCubic(rawT);
    this.interpolateCameraPosition(easedT);
    this.interpolateCameraOrientation(easedT);
    if (rawT >= 1) {
      this.animationActive = false;
    }
    return this.animationActive;
  }

  /**
   * Cancels the current animation and snaps the camera to the interpolated
   * state at the current progress.
   */
  cancel(): void {
    if (!this.animationActive) return;
    const now = performance.now();
    const elapsed = now - this.startTime;
    const rawT = Math.min(elapsed / this.duration, 1);
    const easedT = easeOutCubic(rawT);
    this.interpolateCameraPosition(easedT);
    this.interpolateCameraOrientation(easedT);
    this.animationActive = false;
  }

  /**
   * Checks whether an animation is currently in progress.
   *
   * @returns True if the animator is actively animating.
   */
  isAnimating(): boolean {
    return this.animationActive;
  }

  /**
   * Interpolates the camera position between start and target.
   *
   * @param t The normalized interpolation parameter.
   */
  private interpolateCameraPosition(t: number): void {
    this.camera.position.lerpVectors(this.startPosition, this.targetPosition, t);
  }

  /**
   * Turns the camera between the start and target orientation along the
   * shortest arc, so the view never swings through a point it passes.
   *
   * @param t The normalized interpolation parameter.
   */
  private interpolateCameraOrientation(t: number): void {
    this.camera.quaternion.slerpQuaternions(this.startOrientation, this.targetOrientation, t);
  }

  /**
   * Stores the orientation the camera has when it stands at the target position
   * and looks at the target look-at point.
   *
   * @param camera The perspective camera, whose up vector is kept.
   */
  private targetOrientationCompute(camera: THREE.PerspectiveCamera): void {
    const lookMatrix = new THREE.Matrix4().lookAt(this.targetPosition, this.targetLookAt, camera.up);
    this.targetOrientation.setFromRotationMatrix(lookMatrix);
  }

  /** Immediately sets the camera to the target position and look-at. */
  private snapToTarget(): void {
    this.camera.position.copy(this.targetPosition);
    this.camera.lookAt(this.targetLookAt);
  }
}
