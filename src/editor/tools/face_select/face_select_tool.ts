import type { Vector2 } from 'three';
import { Tool } from '../tool.js';

/** Mouse button index of the left button. */
const FACE_SELECT_TOOL_PRIMARY_BUTTON = 0;

/** Mouse button index of the right button. */
const FACE_SELECT_TOOL_SECONDARY_BUTTON = 2;

/**
 * Permanent face selection tool. Owns face pick/paint/UV smear mouse input so
 * tools that do not inherit BoxSelectTool never object-select by accident.
 * Right-button presses that start a face stroke (displacement painting) are
 * held by this tool instead of viewport navigation.
 */
export class FaceSelectTool extends Tool {
  private strokeActive: boolean;
  private strokeButton: number;
  /**
   * When true, the next deactivate skips leaving face mode so a single-use UV
   * child tool can keep the face selection alive.
   */
  private preserveFaceModeForSingleUseChild: boolean;

  /** Creates a face select tool. */
  constructor() {
    super();
    this.strokeActive = false;
    this.strokeButton = FACE_SELECT_TOOL_PRIMARY_BUTTON;
    this.preserveFaceModeForSingleUseChild = false;
  }

  /**
   * Busy while a face paint, UV smear, or drag-owned UV transform stroke is
   * live. Returns false when this tool is not the active tool so single-use UV
   * children can take event focus after activation.
   *
   * @returns True during an active face stroke owned by this tool.
   */
  override isBusy(): boolean {
    if (this.editor?.activeTool !== this) {
      return false;
    }
    if (this.strokeActive) {
      return true;
    }
    return this.editor?.getServices()?.isFaceSelectStrokeActive() === true;
  }

  /** Called when the tool is activated. */
  override onActivate(): void {
    this.strokeActive = false;
    this.preserveFaceModeForSingleUseChild = false;
    this.editor?.getServices()?.enterFaceSelectionMode();
    this.editor?.getServices()?.setStatusMessage('Face select');
  }

  /** Called when the tool is deactivated. */
  override onDeactivate(): void {
    this.strokeActive = false;
    this.editor?.getServices()?.endFaceSelectPointerUp();
    if (this.consumePreserveFaceModeForSingleUseChild()) {
      return;
    }
    this.editor?.getServices()?.leaveFaceSelectionMode();
  }

  /**
   * Consumes the one-shot flag that keeps face mode across a single-use child.
   *
   * @returns True when face mode must stay active for the child tool.
   */
  private consumePreserveFaceModeForSingleUseChild(): boolean {
    if (!this.preserveFaceModeForSingleUseChild) {
      return false;
    }
    this.preserveFaceModeForSingleUseChild = false;
    return true;
  }

  /**
   * Returns whether a right-button press started a face stroke that this tool
   * holds.
   *
   * @param button Mouse button index of the press.
   * @returns True while a stroke held by that button is active.
   */
  override claimsViewportNavigationPress(button: number): boolean {
    return this.isStrokeHeldBy(button);
  }

  /**
   * Called when the tool receives a mouse down event: the left button picks or
   * paints faces, the right button paints displacements or arms the texture
   * apply click.
   *
   * @param button Mouse button index.
   */
  override onMouseDown(button: number): void {
    if (button === FACE_SELECT_TOOL_SECONDARY_BUTTON) {
      this.secondaryPressForward();
      return;
    }
    if (button !== FACE_SELECT_TOOL_PRIMARY_BUTTON || !this.editor) {
      return;
    }
    const services = this.editor.getServices();
    if (!services) {
      return;
    }
    const started = services.beginFaceSelectPointerDown(
      this.editor.lastPointerClientX,
      this.editor.lastPointerClientY,
      this.editor.isShiftPressed,
      this.editor.isCtrlPressed,
    );
    this.strokeStateWrite(started, FACE_SELECT_TOOL_PRIMARY_BUTTON);
  }

  /**
   * Forwards a right-button press to the face services and holds the stroke
   * when it started one.
   */
  private secondaryPressForward(): void {
    if (!this.editor) {
      return;
    }
    const started = this.editor
      .getServices()
      ?.beginFaceSelectSecondaryPress?.(this.editor.lastPointerClientX, this.editor.lastPointerClientY);
    if (started === true) {
      this.strokeStateWrite(true, FACE_SELECT_TOOL_SECONDARY_BUTTON);
    }
  }

  /**
   * Stores whether a face stroke is active and which button holds it.
   *
   * @param isActive True while the stroke is live.
   * @param button Mouse button index holding the stroke.
   */
  private strokeStateWrite(isActive: boolean, button: number): void {
    this.strokeActive = isActive;
    this.strokeButton = button;
  }

  /**
   * Returns whether an active face stroke is held by a mouse button.
   *
   * @param button Mouse button index.
   * @returns True while a stroke held by that button is active.
   */
  private isStrokeHeldBy(button: number): boolean {
    return this.strokeActive && this.strokeButton === button;
  }

  /**
   * Called when the tool receives a mouse move event.
   *
   * @param _screenDelta Screen-space movement delta.
   * @param _gridDelta Grid/world-space movement delta.
   */
  override onMouseMove(_screenDelta: Vector2, _gridDelta: Vector2): void {
    this.forwardFacePointerMoveIfStrokeActive();
  }

  /**
   * Called when the tool receives a mouse drag event.
   *
   * @param button Mouse button index.
   * @param _screenDelta Screen-space movement delta.
   * @param _gridDelta Grid/world-space movement delta.
   */
  override onMouseDrag(button: number, _screenDelta: Vector2, _gridDelta: Vector2): void {
    if (button !== 0) {
      return;
    }
    this.forwardFacePointerMoveIfStrokeActive();
  }

  /**
   * Called when the tool receives a global mouse drag event.
   *
   * @param button Mouse button index.
   * @param screenDelta Screen-space movement delta.
   * @param gridDelta Grid/world-space movement delta.
   */
  override onGlobalMouseDrag(button: number, screenDelta: Vector2, gridDelta: Vector2): void {
    this.onMouseDrag(button, screenDelta, gridDelta);
  }

  /**
   * Called when the tool receives a global mouse up event: the left button, or
   * the right button holding a stroke, ends the face stroke.
   *
   * @param button Mouse button index.
   */
  override onGlobalMouseUp(button: number): void {
    if (button !== FACE_SELECT_TOOL_PRIMARY_BUTTON && !this.isStrokeHeldBy(button)) {
      return;
    }
    this.strokeActive = false;
    this.editor?.getServices()?.endFaceSelectPointerUp();
  }

  /**
   * Launches single-use UV move/rotate/scale with G/R/S when faces are
   * selected.
   *
   * @param keyCode Key code string.
   * @param event Optional keyboard event.
   * @returns True when handled.
   */
  override onKeyDown(keyCode: string, event?: KeyboardEvent): boolean {
    if (!this.editor) {
      return false;
    }
    if (event && (event.ctrlKey || event.metaKey || event.altKey)) {
      return false;
    }
    const services = this.editor.getServices();
    if (!services?.hasFaceSelection()) {
      return false;
    }
    if (keyCode === 'KeyG') {
      this.launchSingleUseUvTool(() => this.editor?.useSingleUseUvMoveTool());
      return true;
    }
    if (keyCode === 'KeyR') {
      this.launchSingleUseUvTool(() => this.editor?.useSingleUseUvRotateTool());
      return true;
    }
    if (keyCode === 'KeyS' && !event?.shiftKey) {
      this.launchSingleUseUvTool(() => this.editor?.useSingleUseUvScaleTool());
      return true;
    }
    if (keyCode === 'Escape') {
      services.cancelFaceUvTransform();
      return false;
    }
    return false;
  }

  /**
   * Marks face mode to survive the coming deactivate, then starts a single-use
   * UV tool parented to this tool.
   *
   * @param launch Callback that switches to the single-use UV tool.
   */
  private launchSingleUseUvTool(launch: () => void): void {
    this.preserveFaceModeForSingleUseChild = true;
    launch();
  }

  /**
   * Forwards move samples to face paint while a stroke is active, with the
   * buttons bit of the button holding the stroke.
   */
  private forwardFacePointerMoveIfStrokeActive(): void {
    if (!this.strokeActive || !this.editor) {
      return;
    }
    const services = this.editor.getServices();
    if (!services) {
      return;
    }
    const buttons = this.strokeButton === FACE_SELECT_TOOL_SECONDARY_BUTTON ? 2 : 1;
    services.continueFaceSelectPointerMove(this.editor.lastPointerClientX, this.editor.lastPointerClientY, buttons);
  }
}
