import { TextSelectionSuppression } from '@/ui/text_selection/text_selection_suppression.js';
import {
  PANEL_FLOATING_LAYOUT_MIN_HEIGHT_PX,
  PANEL_FLOATING_LAYOUT_MIN_WIDTH_PX,
  panelFloatingLayoutRectOf,
  type PanelFloatingLayoutRect,
} from './panel_floating_layout_rect.js';

/** Edge or corner of a window a resize handle drags. */
export type PanelFloatingResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Every resize handle, edges first. */
export const PANEL_FLOATING_RESIZE_EDGES: readonly PanelFloatingResizeEdge[] = [
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
];

/** Data attribute naming the edge of a resize handle element. */
export const PANEL_FLOATING_RESIZE_EDGE_ATTRIBUTE = 'data-panel-floating-resize-edge';

/** Thickness of the grab area of a resize handle in CSS pixels. */
const PANEL_FLOATING_RESIZE_GRIP_PX = 6;

/**
 * Computes the rect of a window after dragging one of its edges or corners,
 * keeping the opposite edges still and the size above the minimum.
 *
 * @param startRect Window rect when the drag began.
 * @param edge Dragged edge or corner.
 * @param deltaX Pointer travel to the right in CSS pixels.
 * @param deltaY Pointer travel downwards in CSS pixels.
 * @returns New window rect.
 */
export function panelFloatingResizeRectCompute(
  startRect: PanelFloatingLayoutRect,
  edge: PanelFloatingResizeEdge,
  deltaX: number,
  deltaY: number,
): PanelFloatingLayoutRect {
  const horizontal = panelFloatingResizeSpanCompute(startRect.left, startRect.width, edge, 'w', 'e', deltaX);
  const vertical = panelFloatingResizeSpanCompute(startRect.top, startRect.height, edge, 'n', 's', deltaY);
  return { left: horizontal.start, top: vertical.start, width: horizontal.size, height: vertical.size };
}

/**
 * Computes the start and size of one axis after dragging an edge on it.
 *
 * @param start Start coordinate of the axis.
 * @param size Size along the axis.
 * @param edge Dragged edge or corner.
 * @param startEdge Letter of the edge at the start of the axis.
 * @param endEdge Letter of the edge at the end of the axis.
 * @param delta Pointer travel along the axis.
 * @returns New start and size.
 */
function panelFloatingResizeSpanCompute(
  start: number,
  size: number,
  edge: PanelFloatingResizeEdge,
  startEdge: 'n' | 'w',
  endEdge: 's' | 'e',
  delta: number,
): { start: number; size: number } {
  const minimum = startEdge === 'w' ? PANEL_FLOATING_LAYOUT_MIN_WIDTH_PX : PANEL_FLOATING_LAYOUT_MIN_HEIGHT_PX;
  if (edge.includes(endEdge)) {
    return { start, size: Math.max(minimum, size + delta) };
  }
  if (edge.includes(startEdge)) {
    const clampedSize = Math.max(minimum, size - delta);
    return { start: start + size - clampedSize, size: clampedSize };
  }
  return { start, size };
}

/**
 * Grab areas along the edges and corners of a floating window that resize it by
 * dragging. They are hidden while the window is docked.
 */
export class PanelFloatingResizeHandles {
  private readonly root: HTMLElement;
  private readonly handles: HTMLElement[];
  private readonly onResizeEnd: (rect: PanelFloatingLayoutRect) => void;

  /**
   * Adds the grab areas to a window root.
   *
   * @param root Window root, positioned fixed while floating.
   * @param onResizeEnd Receives the window rect after each resize.
   */
  constructor(root: HTMLElement, onResizeEnd: (rect: PanelFloatingLayoutRect) => void) {
    this.root = root;
    this.onResizeEnd = onResizeEnd;
    this.handles = PANEL_FLOATING_RESIZE_EDGES.map((edge) => this.handleCreate(edge));
    this.root.append(...this.handles);
  }

  /**
   * Shows or hides the grab areas.
   *
   * @param isVisible True while the window floats.
   */
  visibleSet(isVisible: boolean): void {
    this.handles.forEach((handle) => (handle.style.display = isVisible ? 'block' : 'none'));
  }

  /**
   * Creates the grab area of one edge or corner.
   *
   * @param edge Edge or corner.
   * @returns Handle element.
   */
  private handleCreate(edge: PanelFloatingResizeEdge): HTMLElement {
    const handle = this.root.ownerDocument.createElement('div');
    handle.setAttribute(PANEL_FLOATING_RESIZE_EDGE_ATTRIBUTE, edge);
    handle.style.position = 'absolute';
    handle.style.zIndex = '2';
    handle.style.cursor = `${edge}-resize`;
    this.handlePlacementApply(handle, edge);
    handle.addEventListener('pointerdown', (event) => this.resizeBegin(event, edge));
    return handle;
  }

  /**
   * Places a grab area along its edge, or as a square on its corner.
   *
   * @param handle Handle element.
   * @param edge Edge or corner.
   */
  private handlePlacementApply(handle: HTMLElement, edge: PanelFloatingResizeEdge): void {
    const grip = `${PANEL_FLOATING_RESIZE_GRIP_PX}px`;
    const isCorner = edge.length === 2;
    handle.style.top = edge.includes('s') ? 'auto' : '0';
    handle.style.bottom = edge.includes('n') ? 'auto' : '0';
    handle.style.left = edge.includes('e') ? 'auto' : '0';
    handle.style.right = edge.includes('w') ? 'auto' : '0';
    const spansHorizontally = edge === 'n' || edge === 's';
    const spansVertically = edge === 'e' || edge === 'w';
    handle.style.width = spansHorizontally ? 'auto' : isCorner ? `${PANEL_FLOATING_RESIZE_GRIP_PX * 2}px` : grip;
    handle.style.height = spansVertically ? 'auto' : isCorner ? `${PANEL_FLOATING_RESIZE_GRIP_PX * 2}px` : grip;
  }

  /**
   * Starts resizing from a press on a grab area.
   *
   * @param event Pointer press.
   * @param edge Pressed edge or corner.
   */
  private resizeBegin(event: PointerEvent, edge: PanelFloatingResizeEdge): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const startRect = panelFloatingLayoutRectOf(this.root);
    const ownerDocument = this.root.ownerDocument;
    const textSelectionSuppression = new TextSelectionSuppression(ownerDocument);
    textSelectionSuppression.begin();
    const abortController = new AbortController();
    const options = { signal: abortController.signal, capture: true };
    ownerDocument.addEventListener(
      'pointermove',
      (moveEvent) => this.resizeMove(moveEvent, event, edge, startRect),
      options,
    );
    ownerDocument.addEventListener(
      'pointerup',
      () => this.resizeEnd(abortController, textSelectionSuppression),
      options,
    );
    ownerDocument.addEventListener(
      'pointercancel',
      () => this.resizeEnd(abortController, textSelectionSuppression),
      options,
    );
  }

  /**
   * Resizes the window while the pointer moves.
   *
   * @param moveEvent Pointer move.
   * @param pressEvent Pointer press that began the resize.
   * @param edge Dragged edge or corner.
   * @param startRect Window rect when the resize began.
   */
  private resizeMove(
    moveEvent: PointerEvent,
    pressEvent: PointerEvent,
    edge: PanelFloatingResizeEdge,
    startRect: PanelFloatingLayoutRect,
  ): void {
    const deltaX = moveEvent.clientX - pressEvent.clientX;
    const deltaY = moveEvent.clientY - pressEvent.clientY;
    const rect = panelFloatingResizeRectCompute(startRect, edge, deltaX, deltaY);
    this.root.style.left = `${rect.left}px`;
    this.root.style.top = `${rect.top}px`;
    this.root.style.width = `${rect.width}px`;
    this.root.style.height = `${rect.height}px`;
    this.root.style.maxHeight = 'none';
  }

  /**
   * Stops resizing and reports the final rect.
   *
   * @param abortController Controller of the resize listeners.
   * @param textSelectionSuppression Text selection suppression of the resize.
   */
  private resizeEnd(abortController: AbortController, textSelectionSuppression: TextSelectionSuppression): void {
    abortController.abort();
    textSelectionSuppression.end();
    this.onResizeEnd(panelFloatingLayoutRectOf(this.root));
  }
}
