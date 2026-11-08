import type { Vector2 } from 'three';
import { Tool } from '../tool.js';
import { boxSelectApplyClickSelection } from './box_select_click_select.js';
import { BoxSelectDragGesture } from './box_select_drag_gesture.js';
import { BoxSelectSprinklePress } from './box_select_sprinkle_press.js';
import {
  boxSelectModifierKeyIs,
  boxSelectPointerSampleRead,
  boxSelectPointerSampleWithKeyReleased,
} from './box_select_pointer_sample.js';
import { getStateEntityPlace } from '@/tools/entity_place/state_entity_place.js';
import { getStatePolygonTool } from '@/tools/polygon/state_polygon_tool.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import type { EditorServices } from '@/editor/window/editor_services.js';

/** Status shown when S is pressed on a selection that may not be scaled. */
const BOX_SELECT_SCALE_NOT_ALLOWED_MESSAGE = 'Scale unavailable: point entities and lights only move and rotate';

/**
 * Shape Editor BoxSelectTool: object selection on OnGlobalMouseUp, G/R/S
 * single-use launches, and left-button drags that move the selection or draw a
 * new brush. No gizmo ownership — gizmos live on widgets of BoundsTool /
 * TranslateTool / RotateTool / ScaleTool.
 */
export class BoxSelectTool extends Tool {
  private readonly dragGesture = new BoxSelectDragGesture();
  private readonly sprinklePress = new BoxSelectSprinklePress();

  /** Creates a box select tool. */
  constructor() {
    super();
  }

  /**
   * Busy while an object drag or a Sprinkle press runs so the tool keeps
   * exclusive input.
   *
   * @returns True during an object drag session or a Sprinkle press.
   */
  override isBusy(): boolean {
    return this.dragGesture.isSessionActive() || this.sprinklePress.isPressActive();
  }

  /**
   * Returns whether a right-button Sprinkle resize holds the press, so the
   * press must not also fly or pan the view.
   *
   * @param button Mouse button index of the press.
   * @returns True while that button holds a Sprinkle press.
   */
  override claimsViewportNavigationPress(button: number): boolean {
    return this.sprinklePress.isPressHeldBy(button);
  }

  /** Called when the tool is activated. */
  override onActivate(): void {
    this.editor?.getServices()?.setStatusMessage('Select');
  }

  /**
   * Cancels a running object drag or Sprinkle press when the tool is
   * deactivated.
   */
  override onDeactivate(): void {
    this.dragGesture.reset();
    this.sprinklePress.reset();
  }

  /** Cancels a running object drag or Sprinkle press when the tool loses focus. */
  override onFocusLost(): void {
    this.dragGesture.reset();
    this.sprinklePress.reset();
  }

  /** Called when the tool is rendered. */
  override onRender(): void {}

  /**
   * Returns whether the tool is idle for object double-clicks: it is no
   * single-use launch, no object drag runs and no Entity, Polygon or Sprinkle
   * placement takes the clicks.
   *
   * @returns True when a double-click may open Object Properties.
   */
  isObjectDoubleClickReady(): boolean {
    return !this.isSingleUse && !this.dragGesture.isSessionActive() && !this.hammerToolActiveIs();
  }

  /**
   * Returns whether the Entity, Polygon or Sprinkle tool takes viewport clicks.
   *
   * @returns True while one of those tools is active.
   */
  private hammerToolActiveIs(): boolean {
    return (
      getStateEntityPlace().toolActiveRead() ||
      getStatePolygonTool().toolActiveRead() ||
      getStateSprinkleTool().toolActiveRead()
    );
  }

  /**
   * Hands a press over a surface to the Sprinkle tool while it is active,
   * otherwise records a left-button press as a possible drag start.
   *
   * @param button Mouse button index.
   */
  override onMouseDown(button: number): void {
    if (this.isSingleUse || !this.editor) {
      return;
    }
    if (this.sprinklePress.pressBegin(this.editor, button) || button !== 0) {
      return;
    }
    this.dragGesture.pressBegin(boxSelectPointerSampleRead(this.editor));
  }

  /**
   * Ends a Sprinkle press held by the button, otherwise ends a left-button
   * press: commits a running drag, otherwise applies click selection.
   *
   * @param button Mouse button index.
   */
  override onGlobalMouseUp(button: number): void {
    if (this.sprinklePress.pressEnd(button) || button !== 0) {
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
   * Feeds pointer movement to a held Sprinkle press, otherwise left-button
   * movement to the drag gesture.
   *
   * @param button Mouse button index.
   * @param _screenDelta Screen-space movement delta.
   * @param _gridDelta Grid/world-space movement delta.
   */
  override onGlobalMouseDrag(button: number, _screenDelta: Vector2, _gridDelta: Vector2): void {
    if (this.editor && this.sprinklePress.isPressActive()) {
      this.sprinklePress.pressMove(this.editor);
      return;
    }
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
    if (getStatePolygonTool().toolActiveRead() && this.handlePolygonToolKeyDown(keyCode)) {
      return true;
    }
    if (this.isSingleUse || !this.editor) {
      return false;
    }
    return this.dispatchSingleUseLaunchKeys(keyCode);
  }

  /**
   * Handles Enter, Backspace, and Escape while the Polygon brush tool is
   * active.
   *
   * @param keyCode Key code string.
   * @returns True when consumed.
   */
  private handlePolygonToolKeyDown(keyCode: string): boolean {
    if (keyCode === 'Enter' || keyCode === 'NumpadEnter') {
      return getStatePolygonTool().commit().length > 0;
    }
    if (keyCode === 'Backspace') {
      getStatePolygonTool().vertexRemoveLast();
      return true;
    }
    if (keyCode === 'Escape') {
      getStatePolygonTool().clear();
      return true;
    }
    return false;
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

  /**
   * Applies Hammer++ Entity/Polygon/Sprinkle placement, otherwise applies the
   * object click at the last pointer position.
   */
  private applyClickSelectionAtLastPointer(): void {
    if (!this.editor) {
      return;
    }
    const cx = this.editor.lastPointerClientX;
    const cy = this.editor.lastPointerClientY;
    if (this.applyHammerToolClick(cx, cy)) {
      return;
    }
    const services = this.editor.getServices();
    if (services) {
      this.objectClickApply(services, cx, cy);
    }
  }

  /**
   * Lets a plain double-click on an object open Object Properties, otherwise
   * lets a Shift+click on a brush face open the Face tool on that face,
   * otherwise applies object click selection (Shift adds, Ctrl toggles).
   *
   * @param services Editor services for double-click, face edit and selection.
   * @param clientX Release client X.
   * @param clientY Release client Y.
   */
  private objectClickApply(services: EditorServices, clientX: number, clientY: number): void {
    const isShiftPressed = this.editor?.isShiftPressed === true;
    const isCtrlPressed = this.editor?.isCtrlPressed === true;
    if (services.objectClickReleaseDoubleClickHandle?.(clientX, clientY, isShiftPressed || isCtrlPressed) === true) {
      return;
    }
    if (isShiftPressed && !isCtrlPressed && services.objectShiftClickFaceEditApply?.(clientX, clientY) === true) {
      return;
    }
    boxSelectApplyClickSelection(services, clientX, clientY, isShiftPressed, isCtrlPressed);
  }

  /**
   * Dispatches viewport clicks to the Entity or Polygon tool when active; the
   * Sprinkle tool paints on press and takes every click without selecting.
   *
   * @param clientX Viewport client X.
   * @param clientY Viewport client Y.
   * @returns True when a specialized tool handled the click.
   */
  private applyHammerToolClick(clientX: number, clientY: number): boolean {
    if (getStateEntityPlace().toolActiveRead()) return getStateEntityPlace().placeAtClientPoint(clientX, clientY);
    if (getStatePolygonTool().toolActiveRead()) return getStatePolygonTool().placeVertexAtClientPoint(clientX, clientY);
    return getStateSprinkleTool().toolActiveRead();
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
      this.singleUseScaleLaunch();
      return true;
    }
    if (keyCode === 'KeyR' && editor.selectedSegmentsCount > 0) {
      editor.useSingleUseRotateTool();
      return true;
    }
    return false;
  }

  /**
   * Starts the single-use scale tool, or reports that the selection only moves
   * and rotates when one of its objects may not be scaled.
   */
  private singleUseScaleLaunch(): void {
    const services = this.editor?.getServices();
    if (services?.isSelectionScaleAllowed?.() === false) {
      services.setStatusMessage(BOX_SELECT_SCALE_NOT_ALLOWED_MESSAGE);
      return;
    }
    this.editor?.useSingleUseScaleTool();
  }
}
