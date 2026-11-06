import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { Theme } from '@/theme.js';
import { StatusBar } from '@/ui/status/status_bar.js';
import { STATUS_CURSOR_COORDS_EMPTY_TEXT, STATUS_SELECTION_EMPTY_TEXT } from '@/ui/status/status_bar_hammer_format.js';

/**
 * Returns one status segment and fails the test when it is missing.
 *
 * @param statusBar Status bar under test.
 * @param selector CSS selector of the segment.
 * @returns Segment element.
 */
function segmentOf(statusBar: StatusBar, selector: string): HTMLElement {
  const segment = statusBar.getRootElement().querySelector<HTMLElement>(selector);
  if (!segment) {
    throw new Error(`missing status segment ${selector}`);
  }
  return segment;
}

describe('StatusBar cursor and selection segments', () => {
  let container: HTMLElement;
  let statusBar: StatusBar;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    statusBar = new StatusBar(container, Theme);
  });

  afterEach(() => {
    statusBar.dispose();
    container.remove();
  });

  it('starts with no cursor position and no selection', () => {
    expect(segmentOf(statusBar, '.status-bar-cursor-coords').textContent).toBe(STATUS_CURSOR_COORDS_EMPTY_TEXT);
    expect(segmentOf(statusBar, '.status-bar-hammer-selection').textContent).toBe('no selection.');
    expect(STATUS_SELECTION_EMPTY_TEXT).toBe('no selection.');
  });

  it('shows the cursor world position in meters with every axis in order', () => {
    const position = { x: 1.5, y: -2.25, z: 10 };
    statusBar.setCursorWorldPosition(position);
    const text = segmentOf(statusBar, '.status-bar-cursor-coords').textContent ?? '';
    expect(text.startsWith('@ (')).toBe(true);
    const values = text.slice(3, -1).split(', ').map(Number);
    expect(values).toEqual([position.x, position.y, position.z]);
  });

  it('writes negative zero as zero', () => {
    statusBar.setCursorWorldPosition({ x: -0, y: -0.001, z: 0 });
    expect(segmentOf(statusBar, '.status-bar-cursor-coords').textContent).not.toContain('-');
  });

  it('clears the cursor position back to the empty marker', () => {
    statusBar.setCursorWorldPosition({ x: 3, y: 4, z: 5 });
    statusBar.setCursorWorldPosition(null);
    expect(segmentOf(statusBar, '.status-bar-cursor-coords').textContent).toBe(STATUS_CURSOR_COORDS_EMPTY_TEXT);
  });

  it('counts selected objects with singular and plural wording', () => {
    const segment = segmentOf(statusBar, '.status-bar-hammer-selection');
    statusBar.setObjectSelectionCount(1);
    expect(segment.textContent).toBe('1 object selected');
    const count = 7;
    statusBar.setObjectSelectionCount(count);
    expect(segment.textContent).toBe(`${count} objects selected`);
  });

  it('uses a custom description when objects are selected and ignores it at zero', () => {
    const segment = segmentOf(statusBar, '.status-bar-hammer-selection');
    const description = 'brush 42 selected';
    statusBar.setObjectSelectionCount(1, description);
    expect(segment.textContent).toBe(description);
    statusBar.setObjectSelectionCount(0, description);
    expect(segment.textContent).toBe('no selection.');
  });

  it('keeps the existing segments when the new ones change', () => {
    statusBar.setUndoRedoCounts(2, 1);
    statusBar.setCursorWorldPosition({ x: 1, y: 2, z: 3 });
    statusBar.setObjectSelectionCount(3);
    expect(segmentOf(statusBar, '.status-bar-help').title).toContain('Undo: 2 | Redo: 1');
    expect(segmentOf(statusBar, '.status-bar-hammer-selection').title).toContain('Selection: Object');
    expect(segmentOf(statusBar, '.status-bar-cursor-coords').textContent).not.toBe(STATUS_CURSOR_COORDS_EMPTY_TEXT);
    expect(segmentOf(statusBar, '.status-bar-hammer-selection').textContent).not.toBe(STATUS_SELECTION_EMPTY_TEXT);
  });

  it('ignores updates after dispose', () => {
    const coords = segmentOf(statusBar, '.status-bar-cursor-coords');
    const selection = segmentOf(statusBar, '.status-bar-hammer-selection');
    statusBar.dispose();
    statusBar.setCursorWorldPosition({ x: 1, y: 2, z: 3 });
    statusBar.setObjectSelectionCount(4);
    expect(coords.textContent).toBe(STATUS_CURSOR_COORDS_EMPTY_TEXT);
    expect(selection.textContent).toBe('no selection.');
  });
});
