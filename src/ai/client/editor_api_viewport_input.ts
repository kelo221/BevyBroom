import * as THREE from 'three';
import type { EditorApiHost, EditorApiViewportView } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import { EditorApiViewportPointer, type EditorApiViewportKeys } from './editor_api_viewport_pointer.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';
import { pointerClientPointOfWorld, type PointerClientPoint } from '@/utils/pointer_client_project.js';

/** Pointer moves a viewport_drag sends when steps is omitted. */
export const EDITOR_API_VIEWPORT_DRAG_DEFAULT_STEPS = 8;

/** Largest number of pointer moves a viewport_drag may send. */
export const EDITOR_API_VIEWPORT_DRAG_MAX_STEPS = 100;

/** View names the viewport input tools accept. */
const EDITOR_API_VIEWPORT_VIEW_NAMES: readonly string[] = [
  ViewportKind.PERSPECTIVE,
  ViewportKind.TOP,
  ViewportKind.FRONT,
  ViewportKind.SIDE,
];

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
    const from = this.worldPointArgRead(args['from']);
    const to = this.worldPointArgRead(args['to']);
    const steps = this.stepsArgRead(args['steps']);
    if (!from || !to) {
      return failResult('from and to must be {x, y, z} with finite numbers');
    }
    if (steps === null) {
      return failResult(`steps must be a whole number from 1 to ${EDITOR_API_VIEWPORT_DRAG_MAX_STEPS}`);
    }
    return this.withTarget(args, (target) => {
      const start = this.clientPointOf(target.viewport, from);
      const end = this.clientPointOf(target.viewport, to);
      target.pointer.hover(start);
      target.pointer.press(start);
      this.dragMovesSend(target.pointer, start, end, steps);
      target.pointer.release(end);
      return this.selectionResultWithMessage(`Dragged in the ${String(args['view'])} view`);
    });
  }

  /**
   * Clicks at one world point.
   *
   * @param args Tool arguments (view, at, keys).
   * @returns Result with the selection afterwards.
   */
  private viewportClick(args: Record<string, unknown>): McpToolResult {
    const at = this.worldPointArgRead(args['at']);
    if (!at) {
      return failResult('at must be {x, y, z} with finite numbers');
    }
    return this.withTarget(args, (target) => {
      const point = this.clientPointOf(target.viewport, at);
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
   * @param body Gesture body.
   * @returns Tool result.
   */
  private withTarget(
    args: Record<string, unknown>,
    body: (target: EditorApiViewportTarget) => McpToolResult,
  ): McpToolResult {
    const view = args['view'];
    if (typeof view !== 'string' || !EDITOR_API_VIEWPORT_VIEW_NAMES.includes(view)) {
      return failResult(`view must be one of ${EDITOR_API_VIEWPORT_VIEW_NAMES.join(', ')}`);
    }
    const keys = this.keysArgRead(args['keys']);
    if (!keys) {
      return failResult('keys must be an object with optional ctrl, shift and alt booleans');
    }
    const viewport = this.visibleViewportFind(view);
    if (!viewport) {
      return failResult(`No visible ${view} view`);
    }
    return body({ viewport, pointer: new EditorApiViewportPointer(viewport.getContentElement(), keys) });
  }

  /**
   * Finds the first interactive view of a kind whose content is on screen.
   *
   * @param view View kind name.
   * @returns Viewport, or null when none is visible.
   */
  private visibleViewportFind(view: string): EditorApiViewportView | null {
    const viewports = this.host.viewportsInteractiveRead?.() ?? [];
    for (const viewport of viewports) {
      if (viewport.getViewportKind() !== view) {
        continue;
      }
      const rect = viewport.getContentElement().getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return viewport;
      }
    }
    return null;
  }

  /**
   * Projects a world point onto a view's content element.
   *
   * @param viewport Target view.
   * @param worldPoint World point.
   * @returns Client point.
   */
  private clientPointOf(viewport: EditorApiViewportView, worldPoint: THREE.Vector3): PointerClientPoint {
    return pointerClientPointOfWorld(worldPoint, viewport.getCamera(), viewport.getContentElement());
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
   * Reads a world point argument.
   *
   * @param value Argument value.
   * @returns World point, or null when invalid.
   */
  private worldPointArgRead(value: unknown): THREE.Vector3 | null {
    if (typeof value !== 'object' || value === null) {
      return null;
    }
    const record = value as Record<string, unknown>;
    const components = [record['x'], record['y'], record['z']];
    if (!components.every((component) => typeof component === 'number' && Number.isFinite(component))) {
      return null;
    }
    return new THREE.Vector3(Number(record['x']), Number(record['y']), Number(record['z']));
  }

  /**
   * Reads the optional keys argument.
   *
   * @param value Argument value.
   * @returns Held keys, or null when invalid.
   */
  private keysArgRead(value: unknown): EditorApiViewportKeys | null {
    if (value === undefined) {
      return { ctrl: false, shift: false, alt: false };
    }
    if (typeof value !== 'object' || value === null) {
      return null;
    }
    const record = value as Record<string, unknown>;
    const names = ['ctrl', 'shift', 'alt'];
    if (!names.every((keyName) => record[keyName] === undefined || typeof record[keyName] === 'boolean')) {
      return null;
    }
    return { ctrl: record['ctrl'] === true, shift: record['shift'] === true, alt: record['alt'] === true };
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
