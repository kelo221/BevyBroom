import type { EditorApiHost, EditorApiViewportView } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import { vec3FromUnknown } from './editor_api_math.js';
import {
  EditorApiViewportPointer,
  editorApiModifierKeysRead,
  type EditorApiViewportButton,
} from './editor_api_viewport_pointer.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import type { PointerClientPoint } from '@/utils/pointer_client_project.js';
import {
  EDITOR_API_VIEWPORT_VIEW_NAMES,
  editorApiViewportClientPointOf,
  editorApiVisibleViewportFind,
} from './editor_api_viewport_locate.js';

/** Pointer moves a viewport_drag sends when steps is omitted. */
export const EDITOR_API_VIEWPORT_DRAG_DEFAULT_STEPS = 8;

/** Largest number of pointer moves a viewport_drag may send. */
export const EDITOR_API_VIEWPORT_DRAG_MAX_STEPS = 100;

/** A viewport input target: the pane and its client points. */
interface EditorApiViewportTarget {
  viewport: EditorApiViewportView;
  pointer: EditorApiViewportPointer;
}

/**
 * Drives the mouse in an editor view: clicks and left-button drags at world
 * points, dispatched as real pointer events so every editor rule (selection,
 * moving, drawing brushes, gizmo handles) applies.
 */
export class EditorApiViewportInput {
  private readonly host: EditorApiHost;
  private readonly selectionResultRead: () => McpToolResult;

  /**
   * Creates the viewport input tools.
   *
   * @param host Live editor systems.
   * @param selectionResultRead Returns the get_selection result.
   */
  constructor(host: EditorApiHost, selectionResultRead: () => McpToolResult) {
    this.host = host;
    this.selectionResultRead = selectionResultRead;
  }

  /**
   * Runs a viewport input tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no viewport input tool.
   */
  viewportInputToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    switch (name) {
      case 'viewport_drag':
        return this.viewportDrag(args);
      case 'viewport_click':
        return this.viewportClick(args);
      default:
        return null;
    }
  }

  /**
   * Presses at one world point, moves to another and releases.
   *
   * @param args Tool arguments (view, from, to, keys, steps).
   * @returns Result with the selection afterwards.
   */
  private viewportDrag(args: Record<string, unknown>): McpToolResult {
    const from = vec3FromUnknown(args['from']);
    const to = vec3FromUnknown(args['to']);
    const steps = this.stepsArgRead(args['steps']);
    if (!from || !to) {
      return failResult('from and to must be {x, y, z} with finite numbers');
    }
    if (steps === null) {
      return failResult(`steps must be a whole number from 1 to ${EDITOR_API_VIEWPORT_DRAG_MAX_STEPS}`);
    }
    return this.withTarget(args, 'left', (target) => {
      const start = editorApiViewportClientPointOf(target.viewport, from);
      const end = editorApiViewportClientPointOf(target.viewport, to);
      target.pointer.hover(start);
      target.pointer.press(start);
      this.dragMovesSend(target.pointer, start, end, steps);
      target.pointer.release(end);
      return this.selectionResultWithMessage(`Dragged in the ${String(args['view'])} view`);
    });
  }

  /**
   * Clicks one mouse button at one world point.
   *
   * @param args Tool arguments (view, at, keys, button).
   * @returns Result with the selection afterwards.
   */
  private viewportClick(args: Record<string, unknown>): McpToolResult {
    const at = vec3FromUnknown(args['at']);
    if (!at) {
      return failResult('at must be {x, y, z} with finite numbers');
    }
    const button = args['button'] ?? 'left';
    if (button !== 'left' && button !== 'right') {
      return failResult('button must be left or right');
    }
    return this.withTarget(args, button, (target) => {
      const point = editorApiViewportClientPointOf(target.viewport, at);
      target.pointer.hover(point);
      target.pointer.press(point);
      target.pointer.release(point);
      return this.selectionResultWithMessage(`Clicked in the ${String(args['view'])} view`);
    });
  }

  /**
   * Resolves the view and keys of a call and runs the gesture body.
   *
   * @param args Tool arguments.
   * @param button Mouse button the gesture presses.
   * @param body Gesture body.
   * @returns Tool result.
   */
  private withTarget(
    args: Record<string, unknown>,
    button: EditorApiViewportButton,
    body: (target: EditorApiViewportTarget) => McpToolResult,
  ): McpToolResult {
    const view = args['view'];
    if (typeof view !== 'string' || !EDITOR_API_VIEWPORT_VIEW_NAMES.includes(view)) {
      return failResult(`view must be one of ${EDITOR_API_VIEWPORT_VIEW_NAMES.join(', ')}`);
    }
    const keys = editorApiModifierKeysRead(args['keys']);
    if (!keys) {
      return failResult('keys must be an object with optional ctrl, shift and alt booleans');
    }
    const viewport = editorApiVisibleViewportFind(this.host, view);
    if (!viewport) {
      return failResult(`No visible ${view} view`);
    }
    return body({ viewport, pointer: new EditorApiViewportPointer(viewport.getContentElement(), keys, button) });
  }

  /**
   * Sends evenly spaced held-button moves from start to end.
   *
   * @param pointer Gesture pointer.
   * @param start Press client point.
   * @param end Release client point.
   * @param steps Number of moves.
   */
  private dragMovesSend(
    pointer: EditorApiViewportPointer,
    start: PointerClientPoint,
    end: PointerClientPoint,
    steps: number,
  ): void {
    for (let step = 1; step <= steps; step++) {
      const fraction = step / steps;
      pointer.dragTo({
        clientX: start.clientX + (end.clientX - start.clientX) * fraction,
        clientY: start.clientY + (end.clientY - start.clientY) * fraction,
      });
    }
  }

  /**
   * Builds the success result carrying the current selection.
   *
   * @param message Result message.
   * @returns Tool result with `selection`.
   */
  private selectionResultWithMessage(message: string): McpToolResult {
    return okResult(message, { selection: this.selectionResultRead().data });
  }

  /**
   * Reads the optional steps argument.
   *
   * @param value Argument value.
   * @returns Number of moves, or null when invalid.
   */
  private stepsArgRead(value: unknown): number | null {
    if (value === undefined) {
      return EDITOR_API_VIEWPORT_DRAG_DEFAULT_STEPS;
    }
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return null;
    }
    return value >= 1 && value <= EDITOR_API_VIEWPORT_DRAG_MAX_STEPS ? value : null;
  }
}
