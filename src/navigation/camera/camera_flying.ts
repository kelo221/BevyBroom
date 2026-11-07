import * as THREE from 'three';
import { ManagerInput } from '@/input/manager_input.js';
import { managerPointerLock } from '@/input/manager_pointer_lock.js';
import { blurActiveFormField } from '@/utils/dom_focus.js';
import { SelectionClickThrough } from '@/selection/object/selection_click_through.js';
import { EditorOrientation } from '@/navigation/orientation/editor_orientation.js';
import { pointerCaptureTry } from '@/utils/pointer_capture.js';
import { MOUSE_MOVE_SPEED_MAX, MOUSE_MOVE_SPEED_MIN } from '@/settings/store/settings_types.js';
import { NAVIGATION_BUTTON_MIDDLE, NAVIGATION_BUTTON_SECONDARY } from './navigation_buttons.js';

/**
 * Factor one wheel notch applies to the fly speed while right-button look is
 * held.
 */
export const CAMERA_FLYING_WHEEL_SPEED_STEP = 1.25;

/**
 * Receives the fly speed after the wheel changed it during right-button look.
 *
 * @param moveSpeed New base fly speed in world units per second.
 */
export type CameraFlyingMoveSpeedChangedListener = (moveSpeed: number) => void;

/**
 * First-person flying camera for the 3D viewport. Look and WASD/QE movement
 * only apply while the right mouse button is held (or middle mouse for pan).
 * This prevents camera drift and tool-key conflicts. Movement reads the
 * physical W, A, S, D, Q, and E positions, so the same cluster moves on every
 * keyboard layout. Yaw and pitch are relative to the shared editor working
 * orientation. Pointer lock uses the shared pointer-lock counter.
 */
export class CameraFlying {
  private canvas: HTMLElement;
  private camera: THREE.PerspectiveCamera;
  private inputManager: ManagerInput;
  private editorOrientation: EditorOrientation;
  private isRotating: boolean;
  private isPanning: boolean;
  private activeButtons: Set<number>;
  private yaw: number;
  private pitch: number;
  private moveSpeed: number;
  private moveSpeedChangedListener: CameraFlyingMoveSpeedChangedListener | null = null;
  /** Multiplier applied to fly speed while Shift is held. */
  private readonly shiftSpeedMultiplier: number;
  private mouseSensitivity: number;
  private panTarget: THREE.Vector3;
  private panDistance: number;
  private altMiddleDragDollyEnabled: boolean;
  private altMiddleDragDollyInverted: boolean;
  private isDisposed: boolean;
  private isEnabled: boolean;
  private holdsPointerLock: boolean;
  private readonly scratchLocalForward: THREE.Vector3;
  private readonly scratchWorldForward: THREE.Vector3;
  private readonly scratchWorldRight: THREE.Vector3;
  private readonly scratchWorldUp: THREE.Vector3;
  private readonly scratchInverseOrientation: THREE.Quaternion;
  private readonly onContextMenu: (event: Event) => void;
  private readonly onPointerDownBound: (event: PointerEvent) => void;
  private readonly onPointerMoveBound: (event: PointerEvent) => void;
  private readonly onPointerUpBound: (event: PointerEvent) => void;
  private readonly onMouseUpBound: (event: MouseEvent) => void;
  private readonly onWheelBound: (event: WheelEvent) => void;
  private readonly onPointerLockChangeBound: () => void;
  /**
   * Creates a flying camera controller for a canvas and perspective camera.
   *
   * @param canvas The DOM element that receives pointer events.
   * @param camera The perspective camera to drive.
   * @param inputManager Shared input state for keyboard queries.
   * @param initialYaw Starting yaw angle in radians.
   * @param initialPitch Starting pitch angle in radians.
   * @param editorOrientation Shared working orientation, or a private default.
   */
  constructor(
    canvas: HTMLElement,
    camera: THREE.PerspectiveCamera,
    inputManager: ManagerInput,
    initialYaw: number,
    initialPitch: number,
    editorOrientation?: EditorOrientation,
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.inputManager = inputManager;
    this.editorOrientation = editorOrientation ?? new EditorOrientation();
    this.isRotating = false;
    this.isPanning = false;
    this.isDisposed = false;
    this.isEnabled = true;
    this.holdsPointerLock = false;
    this.activeButtons = new Set();
    this.yaw = initialYaw;
    this.pitch = initialPitch;
    this.moveSpeed = 10;
    this.shiftSpeedMultiplier = 3;
    this.mouseSensitivity = 0.002;
    this.panTarget = new THREE.Vector3();
    this.panDistance = 1;
    this.altMiddleDragDollyEnabled = false;
    this.altMiddleDragDollyInverted = false;
    this.scratchLocalForward = new THREE.Vector3();
    this.scratchWorldForward = new THREE.Vector3();
    this.scratchWorldRight = new THREE.Vector3();
    this.scratchWorldUp = new THREE.Vector3();
    this.scratchInverseOrientation = new THREE.Quaternion();
    this.onContextMenu = (event) => event.preventDefault();
    this.onPointerDownBound = (event) => this.onPointerDown(event);
    this.onPointerMoveBound = (event) => this.onPointerMove(event);
    this.onPointerUpBound = (event) => this.onPointerUp(event);
    this.onMouseUpBound = (event) => this.onMouseUp(event);
    this.onWheelBound = (event) => this.onWheel(event);
    this.onPointerLockChangeBound = () => this.onPointerLockChange();
    this.setupEventListeners();
  }

  /**
   * Replaces the shared editor orientation used for fly basis math.
   *
   * @param editorOrientation Shared working orientation.
   */
  setEditorOrientation(editorOrientation: EditorOrientation): void {
    this.editorOrientation = editorOrientation;
    this.syncOrientationFromCamera();
  }

  /**
   * Enables or disables fly navigation input and movement.
   *
   * @param enabled True when flying camera may respond to input.
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (enabled) {
      return;
    }
    this.isRotating = false;
    this.isPanning = false;
    this.activeButtons.clear();
    this.dropPointerLock();
  }

  /**
   * Returns whether fly navigation is currently enabled.
   *
   * @returns True when enabled.
   */
  getEnabled(): boolean {
    return this.isEnabled;
  }

  /** Wires pointer and wheel listeners on the canvas. */
  private setupEventListeners(): void {
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    this.canvas.addEventListener('pointerdown', this.onPointerDownBound);
    this.canvas.addEventListener('pointermove', this.onPointerMoveBound);
    this.canvas.addEventListener('pointerup', this.onPointerUpBound);
    this.canvas.addEventListener('pointercancel', this.onPointerUpBound);
    this.canvas.addEventListener('lostpointercapture', this.onPointerUpBound);
    this.canvas.addEventListener('wheel', this.onWheelBound);
    this.canvas.ownerDocument.addEventListener('pointerlockchange', this.onPointerLockChangeBound);
    const ownerWindow = this.getOwnerWindow();
    ownerWindow.addEventListener('pointerup', this.onPointerUpBound);
    ownerWindow.addEventListener('pointercancel', this.onPointerUpBound);
    ownerWindow.addEventListener('mouseup', this.onMouseUpBound);
  }

  /** Removes all listeners so the controller can be garbage-collected. */
  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.isRotating = false;
    this.isPanning = false;
    this.activeButtons.clear();
    this.dropPointerLock();
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.canvas.removeEventListener('pointerdown', this.onPointerDownBound);
    this.canvas.removeEventListener('pointermove', this.onPointerMoveBound);
    this.canvas.removeEventListener('pointerup', this.onPointerUpBound);
    this.canvas.removeEventListener('pointercancel', this.onPointerUpBound);
    this.canvas.removeEventListener('lostpointercapture', this.onPointerUpBound);
    this.canvas.removeEventListener('wheel', this.onWheelBound);
    this.canvas.ownerDocument.removeEventListener('pointerlockchange', this.onPointerLockChangeBound);
    const ownerWindow = this.getOwnerWindow();
    ownerWindow.removeEventListener('pointerup', this.onPointerUpBound);
    ownerWindow.removeEventListener('pointercancel', this.onPointerUpBound);
    ownerWindow.removeEventListener('mouseup', this.onMouseUpBound);
  }

  /**
   * Returns the window that owns the canvas (main window or popup).
   *
   * @returns Owner window for button-release events.
   */
  private getOwnerWindow(): Window {
    return this.canvas.ownerDocument?.defaultView ?? window;
  }

  /**
   * Starts rotate (RMB) or pan (MMB) navigation and requests pointer lock.
   *
   * @param event The pointer down event.
   */
  private onPointerDown(event: PointerEvent): void {
    if (!this.isEnabled) {
      return;
    }
    event.preventDefault();
    pointerCaptureTry(this.canvas, event.pointerId);
    if (event.button === 1) {
      this.beginMiddleButtonPan();
    }
    if (event.button === 2) {
      this.beginSecondaryButtonLook(event);
    }
  }

  /** Starts middle-button pan and pointer lock from a canvas press. */
  private beginMiddleButtonPan(): void {
    blurActiveFormField();
    this.beginPan();
    this.activeButtons.add(1);
    this.takePointerLock();
    SelectionClickThrough.resetClickThrough();
  }

  /**
   * Starts right-button look and pointer lock without a pointerdown on the
   * canvas, so a Face Select apply click can hand the press to the camera after
   * a drag.
   *
   * @param event Move that crossed the click threshold, or the original press.
   */
  beginSecondaryButtonLook(event?: PointerEvent): void {
    if (!this.isEnabled) {
      return;
    }
    pointerCaptureTry(this.canvas, event?.pointerId);
    this.beginSecondaryButtonLookStateWrite();
  }

  /** Writes the rotating state of a right-button look and takes pointer lock. */
  private beginSecondaryButtonLookStateWrite(): void {
    blurActiveFormField();
    this.syncOrientationFromCamera();
    this.isRotating = true;
    this.activeButtons.add(2);
    this.takePointerLock();
    SelectionClickThrough.resetClickThrough();
  }

  /** Begins middle-mouse pan by capturing the look target distance. */
  private beginPan(): void {
    this.syncOrientationFromCamera();
    this.isPanning = true;
    this.panTarget.copy(this.camera.position).add(this.getForward());
    this.panDistance = this.camera.position.distanceTo(this.panTarget);
  }

  /**
   * Updates yaw and pitch from the camera's current world look direction. Call
   * after external camera moves such as fit-to-selection.
   */
  syncOrientationFromCamera(): void {
    const worldForward = new THREE.Vector3();
    this.camera.getWorldDirection(worldForward);
    this.editorOrientation.copyQuaternionTo(this.scratchInverseOrientation);
    this.scratchInverseOrientation.invert();
    this.scratchLocalForward.copy(worldForward).applyQuaternion(this.scratchInverseOrientation);
    this.yaw = Math.atan2(this.scratchLocalForward.x, this.scratchLocalForward.z);
    this.pitch = Math.asin(THREE.MathUtils.clamp(this.scratchLocalForward.y, -1, 1));
  }

  /** Takes one shared pointer-lock ref if this camera does not already hold one. */
  private takePointerLock(): void {
    if (this.holdsPointerLock) {
      return;
    }
    managerPointerLock.lock(this.canvas);
    this.holdsPointerLock = true;
  }

  /** Drops this camera's shared pointer-lock ref when held. */
  private dropPointerLock(): void {
    if (!this.holdsPointerLock) {
      return;
    }
    this.holdsPointerLock = false;
    managerPointerLock.unlock();
  }

  /**
   * Stops navigation and balances the lock counter when the browser ends
   * capture.
   */
  private onPointerLockChange(): void {
    if (!this.holdsPointerLock) {
      return;
    }
    if (managerPointerLock.isBrowserLocked()) {
      return;
    }
    this.isRotating = false;
    this.isPanning = false;
    this.activeButtons.clear();
    this.dropPointerLock();
  }

  /**
   * Applies rotation or pan from pointer movement while navigating.
   *
   * @param event The pointer move event.
   */
  private onPointerMove(event: PointerEvent): void {
    if (!this.isEnabled) {
      return;
    }
    if (this.isRotating) {
      this.handleRotation(event.movementX, event.movementY);
    }
    if (this.isPanning && this.altMiddleDragDollyApplies(event)) {
      this.handleDolly(event.movementY);
    } else if (this.isPanning) {
      this.handlePan(event.movementX, event.movementY);
    }
  }

  /**
   * Ends rotate or pan when a mouse button is released.
   *
   * @param event The pointer up or cancel event.
   */
  private onPointerUp(event: PointerEvent): void {
    this.endNavigationButton(event.button);
  }

  /**
   * Mouse-up fallback for environments that drop pointerup after pointer lock.
   *
   * @param event The mouse up event.
   */
  private onMouseUp(event: MouseEvent): void {
    this.endNavigationButton(event.button);
  }

  /**
   * Clears navigation state for a released mouse button and exits pointer lock.
   *
   * @param button Mouse button index.
   */
  private endNavigationButton(button: number): void {
    if (button === NAVIGATION_BUTTON_MIDDLE) {
      this.isPanning = false;
      this.activeButtons.delete(button);
    }
    if (button === NAVIGATION_BUTTON_SECONDARY) {
      this.isRotating = false;
      this.activeButtons.delete(button);
    }
    if (this.activeButtons.size === 0) {
      this.dropPointerLock();
    }
  }

  /**
   * Changes the fly speed while right-button look is held, otherwise zooms the
   * camera along its look direction.
   *
   * @param event The wheel event.
   */
  private onWheel(event: WheelEvent): void {
    if (!this.isEnabled) {
      return;
    }
    event.preventDefault();
    if (this.isRotating) {
      this.moveSpeedStepFromWheel(event.deltaY);
      return;
    }
    this.dollyFromWheel(event.deltaY);
  }

  /**
   * Moves the camera a fixed step along its look direction for one wheel notch.
   *
   * @param deltaY Wheel delta; positive scrolls toward the user and moves back.
   */
  private dollyFromWheel(deltaY: number): void {
    const forward = this.getForward();
    const zoomAmount = deltaY > 0 ? -1 : 1;
    this.camera.position.addScaledVector(forward, zoomAmount * 0.5);
    SelectionClickThrough.resetClickThrough();
  }

  /**
   * Multiplies or divides the fly speed by one wheel step, clamped to the
   * allowed range, and reports a changed speed to the listener.
   *
   * @param deltaY Wheel delta; negative speeds up, positive slows down, zero
   *   changes nothing.
   */
  private moveSpeedStepFromWheel(deltaY: number): void {
    if (deltaY === 0) {
      return;
    }
    const speedBefore = this.moveSpeed;
    const factor = deltaY < 0 ? CAMERA_FLYING_WHEEL_SPEED_STEP : 1 / CAMERA_FLYING_WHEEL_SPEED_STEP;
    this.setMoveSpeed(speedBefore * factor);
    if (this.moveSpeed !== speedBefore) {
      this.moveSpeedChangedListener?.(this.moveSpeed);
    }
  }

  /**
   * Updates yaw and pitch from mouse deltas.
   *
   * @param deltaX Horizontal mouse movement.
   * @param deltaY Vertical mouse movement.
   */
  private handleRotation(deltaX: number, deltaY: number): void {
    this.yaw -= deltaX * this.mouseSensitivity;
    this.pitch -= deltaY * this.mouseSensitivity;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
  }

  /**
   * Pans the camera in the view plane.
   *
   * @param deltaX Horizontal mouse movement.
   * @param deltaY Vertical mouse movement.
   */
  private handlePan(deltaX: number, deltaY: number): void {
    const right = this.getRight();
    const up = this.getCameraUp();
    const scale = this.panDistance * 0.002;
    this.camera.position.addScaledVector(right, -deltaX * scale);
    this.camera.position.addScaledVector(up, deltaY * scale);
  }

  /**
   * Builds the current world-space forward direction from yaw and pitch.
   *
   * @returns A unit forward vector in world space.
   */
  private getForward(): THREE.Vector3 {
    this.scratchLocalForward.set(
      Math.cos(this.pitch) * Math.sin(this.yaw),
      Math.sin(this.pitch),
      Math.cos(this.pitch) * Math.cos(this.yaw),
    );
    this.editorOrientation.copyQuaternionTo(this.scratchInverseOrientation);
    return this.scratchWorldForward
      .copy(this.scratchLocalForward)
      .applyQuaternion(this.scratchInverseOrientation)
      .normalize();
  }

  /**
   * Builds the camera right vector from forward and editor up.
   *
   * @returns A unit right vector in world space.
   */
  private getRight(): THREE.Vector3 {
    const forward = this.getForward();
    const editorUp = this.getEditorUp();
    this.scratchWorldRight.crossVectors(forward, editorUp);
    if (this.scratchWorldRight.lengthSq() < 1e-12) {
      this.scratchWorldRight.copy(this.editorOrientation.getRight());
    }
    return this.scratchWorldRight.normalize();
  }

  /**
   * Builds the camera up vector from right and forward.
   *
   * @returns A unit up vector in world space.
   */
  private getCameraUp(): THREE.Vector3 {
    const forward = this.getForward();
    const right = this.getRight();
    return this.scratchWorldUp.crossVectors(right, forward).normalize();
  }

  /**
   * Returns the current editor up direction in world space.
   *
   * @returns Unit editor up.
   */
  private getEditorUp(): THREE.Vector3 {
    return this.scratchWorldUp.copy(this.editorOrientation.getUp());
  }

  /**
   * Advances fly movement and applies yaw/pitch orientation while navigating.
   * When idle, the camera transform is left alone so fit animations stick.
   *
   * @param deltaTime Frame delta in seconds.
   */
  update(deltaTime: number): void {
    if (!this.isEnabled || !this.isNavigating()) return;
    const forward = this.getForward();
    if (this.shouldApplyFlyMovement()) {
      this.applyFlyMovement(deltaTime, forward);
    }
    this.camera.up.copy(this.getEditorUp());
    const lookTarget = this.camera.position.clone().add(forward);
    this.camera.lookAt(lookTarget);
  }

  /**
   * Returns true only while right-mouse fly mode is held.
   *
   * @returns Whether fly translation keys should move the camera.
   */
  private shouldApplyFlyMovement(): boolean {
    return this.isRotating;
  }

  /**
   * Applies WASD/QE translation relative to the current view from physical key
   * positions.
   *
   * @param deltaTime Frame delta in seconds.
   * @param forward Current forward direction.
   */
  private applyFlyMovement(deltaTime: number, forward: THREE.Vector3): void {
    const right = this.getRight();
    const editorUp = this.getEditorUp();
    const moveAmount = this.resolveFlyMoveAmount(deltaTime);
    this.applyFlyForwardBack(moveAmount, forward);
    this.applyFlyStrafe(moveAmount, right);
    this.applyFlyVertical(moveAmount, editorUp);
  }

  /**
   * Applies forward and back fly translation for physical KeyW and KeyS.
   *
   * @param moveAmount World units to move this frame.
   * @param forward Current forward direction.
   */
  private applyFlyForwardBack(moveAmount: number, forward: THREE.Vector3): void {
    if (this.inputManager.isPhysicalKeyDown('KeyW')) {
      this.camera.position.addScaledVector(forward, moveAmount);
    }
    if (this.inputManager.isPhysicalKeyDown('KeyS')) {
      this.camera.position.addScaledVector(forward, -moveAmount);
    }
  }

  /**
   * Applies left and right fly translation for physical KeyA and KeyD.
   *
   * @param moveAmount World units to move this frame.
   * @param right Current camera right direction.
   */
  private applyFlyStrafe(moveAmount: number, right: THREE.Vector3): void {
    if (this.inputManager.isPhysicalKeyDown('KeyA')) {
      this.camera.position.addScaledVector(right, -moveAmount);
    }
    if (this.inputManager.isPhysicalKeyDown('KeyD')) {
      this.camera.position.addScaledVector(right, moveAmount);
    }
  }

  /**
   * Applies up and down fly translation for physical KeyQ and KeyE.
   *
   * @param moveAmount World units to move this frame.
   * @param editorUp Editor up direction in world space.
   */
  private applyFlyVertical(moveAmount: number, editorUp: THREE.Vector3): void {
    if (this.inputManager.isPhysicalKeyDown('KeyQ')) {
      this.camera.position.addScaledVector(editorUp, -moveAmount);
    }
    if (this.inputManager.isPhysicalKeyDown('KeyE')) {
      this.camera.position.addScaledVector(editorUp, moveAmount);
    }
  }

  /**
   * Resolves per-frame fly displacement, boosting speed while Shift is held.
   *
   * @param deltaTime Frame delta in seconds.
   * @returns World units to move this frame.
   */
  private resolveFlyMoveAmount(deltaTime: number): number {
    const boost = this.inputManager.isShiftDown() ? this.shiftSpeedMultiplier : 1;
    return this.moveSpeed * boost * deltaTime;
  }

  /**
   * Returns whether the camera is currently in fly or pan navigation.
   *
   * @returns True if right or middle mouse navigation is active.
   */
  isNavigating(): boolean {
    return this.isRotating || this.isPanning;
  }

  /**
   * Returns a copy of the current forward look direction.
   *
   * @returns The forward direction vector.
   */
  getForwardDirection(): THREE.Vector3 {
    return this.getForward().clone();
  }

  /**
   * Returns the current yaw angle in radians.
   *
   * @returns Yaw in radians.
   */
  getYaw(): number {
    return this.yaw;
  }

  /**
   * Returns the current pitch angle in radians.
   *
   * @returns Pitch in radians.
   */
  getPitch(): number {
    return this.pitch;
  }

  /**
   * Sets the base speed used for 3D fly movement, clamped to the mouse move
   * speed range. Does not notify the move speed listener.
   *
   * @param speed World units moved per second before Shift boost.
   */
  setMoveSpeed(speed: number): void {
    this.moveSpeed = THREE.MathUtils.clamp(speed, MOUSE_MOVE_SPEED_MIN, MOUSE_MOVE_SPEED_MAX);
  }

  /**
   * Returns the base speed used for 3D fly movement.
   *
   * @returns World units moved per second before Shift boost.
   */
  getMoveSpeed(): number {
    return this.moveSpeed;
  }

  /**
   * Sets the single listener told when the wheel changes the fly speed.
   *
   * @param listener Receives the new speed, or null to stop listening.
   */
  setMoveSpeedChangedListener(listener: CameraFlyingMoveSpeedChangedListener | null): void {
    this.moveSpeedChangedListener = listener;
  }

  /**
   * Configures whether Alt + middle mouse drag moves the camera along its view
   * direction instead of panning.
   *
   * @param enabled True when Alt + middle drag dollies the camera.
   * @param inverted True when dragging up moves the camera backward.
   */
  setAltMiddleDragDolly(enabled: boolean, inverted: boolean): void {
    this.altMiddleDragDollyEnabled = enabled;
    this.altMiddleDragDollyInverted = inverted;
  }

  /**
   * Returns whether a pan drag event should dolly the camera instead.
   *
   * @param event Pointer move event carrying the Alt modifier state.
   * @returns True when Alt + middle drag dolly is enabled and Alt is held.
   */
  private altMiddleDragDollyApplies(event: PointerEvent): boolean {
    return this.altMiddleDragDollyEnabled && event.altKey;
  }

  /**
   * Moves the camera along its view direction from vertical drag movement.
   *
   * @param deltaY Vertical mouse movement in CSS pixels; dragging up is
   *   negative.
   */
  private handleDolly(deltaY: number): void {
    const direction = this.altMiddleDragDollyInverted ? 1 : -1;
    const scale = this.panDistance * 0.002;
    this.camera.position.addScaledVector(this.getForward(), direction * deltaY * scale);
  }
}
