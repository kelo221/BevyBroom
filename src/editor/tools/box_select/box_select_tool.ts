import type { Vector2 } from 'three';
import { Tool } from '../tool.js';
import { boxSelectApplyClickSelection } from './box_select_click_select.js';
import { BoxSelectDragGesture } from './box_select_drag_gesture.js';
import {
  boxSelectModifierKeyIs,
  boxSelectPointerSampleRead,
  boxSelectPointerSampleWithKeyReleased,
} from './box_select_pointer_sample.js';

/**
 * Shape Editor BoxSelectTool: object selection on OnGlobalMouseUp, G/R/S
 * single-use launches, and left-button drags that move the selection or draw a
 * new brush. No gizmo ownership — gizmos live on widgets of BoundsTool /
 * TranslateTool / RotateTool / ScaleTool.
 */
export class BoxSelectTool extends Tool {
  private readonly dragGesture = new BoxSelectDragGesture();

  /** Creates a box select tool. */
  constructor() {
    super();
  }

  /**
   * Busy while an object drag runs so the tool keeps exclusive input.
   *
   * @returns True during an object drag session.
   */
  override isBusy(): boolean {
    return this.dragGesture.isSessionActive();
  }

  /** Called when the tool is activated. */
  override onActivate(): void {
    this.editor?.getServices()?.setStatusMessage('Select');
  }

  /** Cancels a running object drag when the tool is deactivated. */
  override onDeactivate(): void {
    this.dragGesture.reset();
  }

  /** Cancels a running object drag when the tool loses focus. */
  override onFocusLost(): void {
    this.dragGesture.reset();
  }

  /** Called when the tool is rendered. */
  override onRender(): void {}

  /**
   * Records a left-button press as a possible drag start.
   *
   * @param button Mouse button index.
   */
  override onMouseDown(button: number): void {
    if (button !== 0 || this.isSingleUse || !this.editor) {
      return;
    }
    this.dragGesture.pressBegin(boxSelectPointerSampleRead(this.editor));
  }

  /**
   * Ends a left-button press: commits a running drag, otherwise applies click
   * selection.
   *
   * @param button Mouse button index.
   */
  override onGlobalMouseUp(button: number): void {
    if (button !== 0) {
      return;
    }
    if (this.dragGesture.release()) {
      this.applyClickSelectionAtLastPointer();
    }
  }

  /**
   * Shape Editor OnMouseDrag: in-viewport drags are handled by the global drag.
   *
   * @param _button Mouse button index.
   * @param _screenDelta Screen-space movement delta.
   * @param _gridDelta Grid/world-space movement delta.
   */
  override onMouseDrag(_button: number, _screenDelta: Vector2, _gridDelta: Vector2): void {}

  /**
   * Feeds left-button pointer movement to the drag gesture.
   *
   * @param button Mouse button index.
   * @param _screenDelta Screen-space movement delta.
   * @param _gridDelta Grid/world-space movement delta.
   */
  override onGlobalMouseDrag(button: number, _screenDelta: Vector2, _gridDelta: Vector2): void {
    if (button !== 0 || !this.editor) {
      return;
    }
    this.dragGesture.pointerMoved(boxSelectPointerSampleRead(this.editor), this.editor.getServices());
  }

  /**
   * Called when the tool receives a key down event.
   *
   * @param keyCode Key code string.
   * @param _event Optional original browser keyboard event.
   * @returns True when a drag was cancelled, a single-use tool was started or a
   *   shortcut handled.
   */
  override onKeyDown(keyCode: string, _event?: KeyboardEvent): boolean {
    if (this.dragGesture.isSessionActive()) {
      return this.handleDragSessionKeyDown(keyCode);
    }
    if (this.isSingleUse) {
      return false;
    }
    if (!this.editor) {
      return false;
    }
    return this.dispatchSingleUseLaunchKeys(keyCode);
  }

  /**
   * Re-applies the drag when a modifier key is released.
   *
   * @param keyCode Key code string.
   * @returns True when a running drag consumed the key.
   */
  override onKeyUp(keyCode: string): boolean {
    if (!this.dragGesture.isSessionActive() || !this.editor || !boxSelectModifierKeyIs(keyCode)) {
      return false;
    }
    const sample = boxSelectPointerSampleWithKeyReleased(boxSelectPointerSampleRead(this.editor), keyCode);
    this.dragGesture.modifiersChanged(sample);
    return true;
  }

  /**
   * Handles keys during an object drag: Escape cancels, modifiers re-apply.
   *
   * @param keyCode Key code string.
   * @returns True when the key was consumed.
   */
  private handleDragSessionKeyDown(keyCode: string): boolean {
    if (keyCode === 'Escape') {
      return this.dragGesture.cancelActiveSession();
    }
    if (!this.editor || !boxSelectModifierKeyIs(keyCode)) {
      return false;
    }
    this.dragGesture.modifiersChanged(boxSelectPointerSampleRead(this.editor));
    return true;
  }

  /** Applies object click selection at the last editor pointer sample. */
  private applyClickSelectionAtLastPointer(): void {
    if (!this.editor) {
      return;
    }
    const services = this.editor.getServices();
    if (!services) {
      return;
    }
    boxSelectApplyClickSelection(
      services,
      this.editor.lastPointerClientX,
      this.editor.lastPointerClientY,
      this.editor.isShiftPressed,
      this.editor.isCtrlPressed,
    );
  }

  /**
   * Dispatches G / R / S single-use tool launches matching Shape Editor.
   *
   * @param keyCode Key code string.
   * @returns True when handled.
   */
  private dispatchSingleUseLaunchKeys(keyCode: string): boolean {
    const editor = this.editor;
    if (!editor) {
      return false;
    }
    if (keyCode === 'KeyG' && editor.selectedSegmentsCount > 0) {
      editor.useSingleUseTranslateTool();
      return true;
    }
    if (keyCode === 'KeyS' && !editor.isModifierPressed && editor.selectedSegmentsCount > 0) {
      editor.useSingleUseScaleTool();
      return true;
    }
    if (keyCode === 'KeyR' && editor.selectedSegmentsCount > 0) {
      editor.useSingleUseRotateTool();
      return true;
    }
    return false;
  }
}
