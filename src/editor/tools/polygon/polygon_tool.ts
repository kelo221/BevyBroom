import type { Vector2 } from 'three';
import { Tool } from '../tool.js';
import { getStatePolygonTool } from '@/tools/polygon/state_polygon_tool.js';
import { PolygonClickGesture, type PolygonClickPoint } from './polygon_click_gesture.js';

/** Status shown when the Polygon tool becomes active. */
export const POLYGON_TOOL_STATUS_READY =
  'Polygon tool · click outline points in a 2D view, Enter extrudes, Backspace removes the last point, Esc clears';

/** Status shown when a click could not be mapped onto the sketch plane. */
export const POLYGON_TOOL_STATUS_PLACE_FAILED =
  'Polygon: point not placed · click inside a view (keep to the view the outline started in)';

/** Status shown when a press moved too far to count as a click. */
export const POLYGON_TOOL_STATUS_DRAG_IGNORED = 'Polygon: click without dragging to place a point';

/** Status shown when Enter is pressed with fewer than three points. */
export const POLYGON_TOOL_STATUS_TOO_FEW_POINTS = 'Polygon needs at least 3 points before Enter extrudes it';

/** Status shown when the outline could not be extruded into brushes. */
export const POLYGON_TOOL_STATUS_COMMIT_FAILED = 'Polygon could not be extruded · check that the outline has area';

/**
 * Hammer++ Polygon tool: left clicks place outline points on the sketch plane
 * of the view, the pointer drives a rubber-band preview edge, Enter extrudes
 * the outline into brushes, Backspace removes the last point and Escape clears
 * the outline. It never moves or selects objects.
 */
export class PolygonTool extends Tool {
  private readonly clickGesture = new PolygonClickGesture();
  private leftListener: (() => void) | null = null;

  /** Creates the Polygon tool. */
  constructor() {
    super();
  }

  /**
   * Sets the callback told when the editor switches away from this tool.
   *
   * @param listener Callback, or null to clear.
   */
  leftListenerWrite(listener: (() => void) | null): void {
    this.leftListener = listener;
  }

  /** Shows the Polygon instructions when the tool is activated. */
  override onActivate(): void {
    this.clickGesture.reset();
    this.statusShow(POLYGON_TOOL_STATUS_READY);
  }

  /**
   * Forgets a pending press, turns the Polygon state off (dropping the outline
   * and cursor) and tells the left listener that the tool is gone.
   */
  override onDeactivate(): void {
    this.clickGesture.reset();
    getStatePolygonTool().toolActiveWrite(false);
    getStatePolygonTool().cursorClear();
    this.leftListener?.();
  }

  /** Forgets a pending press when the tool loses input focus. */
  override onFocusLost(): void {
    this.clickGesture.reset();
  }

  /**
   * Records a left-button press as a possible point placement.
   *
   * @param button Mouse button index.
   */
  override onMouseDown(button: number): void {
    if (button !== 0 || !this.editor) {
      return;
    }
    this.clickGesture.pressBegin(this.editor.lastPointerClientX, this.editor.lastPointerClientY);
  }

  /**
   * Places a point at the press when the left-button release stayed within the
   * click tolerance.
   *
   * @param button Mouse button index.
   */
  override onGlobalMouseUp(button: number): void {
    if (button !== 0 || !this.editor || !this.clickGesture.isPressed()) {
      return;
    }
    const click = this.clickGesture.release(this.editor.lastPointerClientX, this.editor.lastPointerClientY);
    if (!click) {
      this.statusShow(POLYGON_TOOL_STATUS_DRAG_IGNORED);
      return;
    }
    this.pointPlace(click);
  }

  /**
   * Moves the rubber-band cursor with the pointer.
   *
   * @param _screenDelta Screen-space movement delta.
   * @param _gridDelta Grid/world-space movement delta.
   */
  override onMouseMove(_screenDelta: Vector2, _gridDelta: Vector2): void {
    this.cursorFollowPointer();
  }

  /**
   * Moves the rubber-band cursor with the pointer while a button is held.
   *
   * @param _button Mouse button index.
   * @param _screenDelta Screen-space movement delta.
   * @param _gridDelta Grid/world-space movement delta.
   */
  override onGlobalMouseDrag(_button: number, _screenDelta: Vector2, _gridDelta: Vector2): void {
    this.cursorFollowPointer();
  }

  /**
   * Handles Enter (extrude), Backspace (remove last point) and Escape (clear
   * the outline). Escape with no outline is left to the editor.
   *
   * @param keyCode Key code string.
   * @param _event Optional original browser keyboard event.
   * @returns True when the key was used.
   */
  override onKeyDown(keyCode: string, _event?: KeyboardEvent): boolean {
    if (keyCode === 'Enter' || keyCode === 'NumpadEnter') {
      this.outlineCommit();
      return true;
    }
    if (keyCode === 'Backspace') {
      getStatePolygonTool().vertexRemoveLast();
      this.pointCountStatusShow();
      return true;
    }
    if (keyCode === 'Escape' && getStatePolygonTool().verticesRead().length > 0) {
      getStatePolygonTool().clear();
      this.statusShow(POLYGON_TOOL_STATUS_READY);
      return true;
    }
    return false;
  }

  /**
   * Adds an outline point at a click and reports the result.
   *
   * @param click Client position the click aimed at.
   */
  private pointPlace(click: PolygonClickPoint): void {
    if (!getStatePolygonTool().placeVertexAtClientPoint(click.clientX, click.clientY)) {
      this.statusShow(POLYGON_TOOL_STATUS_PLACE_FAILED);
      return;
    }
    this.pointCountStatusShow();
  }

  /** Extrudes the outline into brushes and reports the result. */
  private outlineCommit(): void {
    const state = getStatePolygonTool();
    if (state.verticesRead().length < 3) {
      this.statusShow(POLYGON_TOOL_STATUS_TOO_FEW_POINTS);
      return;
    }
    const meshes = state.commit();
    if (meshes.length === 0) {
      this.statusShow(POLYGON_TOOL_STATUS_COMMIT_FAILED);
      return;
    }
    this.statusShow(`Polygon extruded into ${meshes.length} brush${meshes.length === 1 ? '' : 'es'}`);
  }

  /** Moves the rubber-band cursor to the last pointer position. */
  private cursorFollowPointer(): void {
    if (!this.editor) {
      return;
    }
    getStatePolygonTool().cursorUpdateAtClientPoint(this.editor.lastPointerClientX, this.editor.lastPointerClientY);
  }

  /** Reports how many outline points are placed. */
  private pointCountStatusShow(): void {
    const count = getStatePolygonTool().verticesRead().length;
    this.statusShow(`Polygon · ${count} point${count === 1 ? '' : 's'} · Enter extrudes, Backspace removes the last`);
  }

  /**
   * Shows a status bar message.
   *
   * @param message Message text.
   */
  private statusShow(message: string): void {
    this.editor?.getServices()?.setStatusMessage(message);
  }
}
