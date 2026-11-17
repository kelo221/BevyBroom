import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PANEL_FLOATING_RESIZE_EDGE_ATTRIBUTE,
  PANEL_FLOATING_RESIZE_EDGES,
  PanelFloatingResizeHandles,
  panelFloatingResizeRectCompute,
} from '@/ui/floating_panel/layout/panel_floating_resize_handles.js';
import {
  PANEL_FLOATING_LAYOUT_MIN_HEIGHT_PX,
  PANEL_FLOATING_LAYOUT_MIN_WIDTH_PX,
  panelFloatingLayoutRectRead,
} from '@/ui/floating_panel/layout/panel_floating_layout_rect.js';

/** Window rect the resize tests start from. */
const START_RECT = { left: 100, top: 80, width: 400, height: 300 };

/**
 * Resize grab areas move only the dragged edges of a floating window, keep the
 * opposite edges still and never shrink it below the minimum size.
 */
describe('panelFloatingResizeRectCompute', () => {
  it('grows the right and bottom edges by the pointer travel', () => {
    expect(panelFloatingResizeRectCompute(START_RECT, 'se', 30, 20)).toEqual({
      ...START_RECT,
      width: START_RECT.width + 30,
      height: START_RECT.height + 20,
    });
  });

  it('moves the left and top edges while keeping the right and bottom edges still', () => {
    const rect = panelFloatingResizeRectCompute(START_RECT, 'nw', 50, 40);
    expect(rect.left + rect.width).toBe(START_RECT.left + START_RECT.width);
    expect(rect.top + rect.height).toBe(START_RECT.top + START_RECT.height);
    expect(rect.left).toBe(START_RECT.left + 50);
  });

  it('changes only the axis of a side edge', () => {
    const rect = panelFloatingResizeRectCompute(START_RECT, 'e', 25, 999);
    expect(rect).toEqual({ ...START_RECT, width: START_RECT.width + 25 });
  });

  it('stops at the minimum size and keeps the opposite edge still', () => {
    const rect = panelFloatingResizeRectCompute(START_RECT, 'nw', 10000, 10000);
    expect(rect.width).toBe(PANEL_FLOATING_LAYOUT_MIN_WIDTH_PX);
    expect(rect.height).toBe(PANEL_FLOATING_LAYOUT_MIN_HEIGHT_PX);
    expect(rect.left + rect.width).toBe(START_RECT.left + START_RECT.width);
  });
});

describe('PanelFloatingResizeHandles', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('adds a grab area per edge and corner and resizes the root by dragging one', () => {
    const root = document.createElement('div');
    root.style.position = 'fixed';
    root.getBoundingClientRect = () => {
      const width = parseFloat(root.style.width) || START_RECT.width;
      const height = parseFloat(root.style.height) || START_RECT.height;
      const left = parseFloat(root.style.left) || START_RECT.left;
      const top = parseFloat(root.style.top) || START_RECT.top;
      return new DOMRect(left, top, width, height);
    };
    document.body.appendChild(root);
    const onResizeEnd = vi.fn();
    new PanelFloatingResizeHandles(root, onResizeEnd);
    expect(root.querySelectorAll(`[${PANEL_FLOATING_RESIZE_EDGE_ATTRIBUTE}]`)).toHaveLength(
      PANEL_FLOATING_RESIZE_EDGES.length,
    );
    const corner = root.querySelector(`[${PANEL_FLOATING_RESIZE_EDGE_ATTRIBUTE}="se"]`);
    corner?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 500, clientY: 380 }));
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 560, clientY: 420 }));
    expect(document.body.style.userSelect).toBe('none');
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 560, clientY: 420 }));
    expect(root.style.width).toBe(`${START_RECT.width + 60}px`);
    expect(root.style.height).toBe(`${START_RECT.height + 40}px`);
    expect(onResizeEnd).toHaveBeenCalledWith({
      ...START_RECT,
      width: START_RECT.width + 60,
      height: START_RECT.height + 40,
    });
    expect(document.body.style.userSelect).toBe('');
  });
});

describe('panelFloatingLayoutRectRead', () => {
  it('reads a usable rect and refuses broken or too small ones', () => {
    expect(panelFloatingLayoutRectRead(START_RECT)).toEqual(START_RECT);
    expect(panelFloatingLayoutRectRead({ ...START_RECT, width: Number.NaN })).toBeNull();
    expect(panelFloatingLayoutRectRead({ ...START_RECT, height: PANEL_FLOATING_LAYOUT_MIN_HEIGHT_PX - 1 })).toBeNull();
    expect(panelFloatingLayoutRectRead('rect')).toBeNull();
  });
});
