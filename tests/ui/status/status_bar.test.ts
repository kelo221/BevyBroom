import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Theme } from '@/theme.js';
import { StatusBar } from '@/ui/status/status_bar.js';
import { STATUS_HELP_IDLE_TEXT, statusSnapFormat, statusZoomFormat } from '@/ui/status/status_bar_hammer_format.js';

/**
 * Returns one status field and fails the test when it is missing.
 *
 * @param statusBar Status bar under test.
 * @param className CSS class of the field.
 * @returns Field element.
 */
function statusBarTestFieldRead(statusBar: StatusBar, className: string): HTMLElement {
  const field = statusBar.getRootElement().querySelector<HTMLElement>(`.${className}`);
  if (!field) {
    throw new Error(`Missing status field ${className}`);
  }
  return field;
}

/**
 * Returns the index of a field among the status bar fields.
 *
 * @param statusBar Status bar under test.
 * @param className CSS class of the field.
 * @returns Field index from the left.
 */
function statusBarTestFieldIndex(statusBar: StatusBar, className: string): number {
  return Array.from(statusBar.getRootElement().children).indexOf(statusBarTestFieldRead(statusBar, className));
}

describe('StatusBar', () => {
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

  it('lays out help, selection, cursor, zoom and snap fields from left to right', () => {
    const order = [
      'status-bar-help',
      'status-bar-hammer-selection',
      'status-bar-cursor-coords',
      'status-bar-zoom',
      'status-bar-snap',
    ].map((className) => statusBarTestFieldIndex(statusBar, className));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((first, second) => first - second)).toEqual(order);
  });

  it('is exactly the theme status bar height', () => {
    expect(statusBar.getRootElement().style.height).toBe(`${Theme.statusBarHeightPx}px`);
  });

  it('shows the idle help text until an action is reported, and again once cleared', () => {
    const help = statusBarTestFieldRead(statusBar, 'status-bar-help');
    expect(help.textContent).toBe(STATUS_HELP_IDLE_TEXT);
    statusBar.setLastAction('Duplicated 2 object(s)');
    expect(help.textContent).toBe('Duplicated 2 object(s)');
    statusBar.setLastAction('');
    expect(help.textContent).toBe(STATUS_HELP_IDLE_TEXT);
  });

  it('shows fit feedback over the last action until it is cleared', () => {
    const help = statusBarTestFieldRead(statusBar, 'status-bar-help');
    statusBar.setLastAction('Moved');
    statusBar.setFitFeedback('Framed 3 objects');
    expect(help.textContent).toBe('Framed 3 objects');
    statusBar.setFitFeedback('');
    expect(help.textContent).toBe('Moved');
  });

  it('lists undo and redo counts, the save state and the modes in the help tooltip', () => {
    const help = statusBarTestFieldRead(statusBar, 'status-bar-help');
    statusBar.setUndoRedoCounts(5, 3);
    statusBar.setLastSavedInfo('arena.broom');
    statusBar.setUnsavedChanges(true);
    statusBar.setTransformMode('Rotate');
    statusBar.setShadingMode('Wireframe');
    const tooltipLines = help.title.split('\n');
    expect(tooltipLines).toContain('Undo: 5 | Redo: 3');
    expect(tooltipLines).toContain('Saved: arena.broom');
    expect(tooltipLines).toContain('Unsaved changes');
    expect(tooltipLines).toContain('Mode: Rotate');
    expect(tooltipLines).toContain('Shading: Wireframe');
    expect(statusBar.getRootElement().textContent).not.toContain('Undo:');
  });

  it('reports the unsaved state it shows', () => {
    statusBar.setUnsavedChanges(true);
    expect(statusBar.isUnsavedChangesShown()).toBe(true);
    statusBar.setUnsavedChanges(false);
    expect(statusBar.isUnsavedChangesShown()).toBe(false);
    expect(statusBarTestFieldRead(statusBar, 'status-bar-help').title.split('\n')).toContain('No unsaved changes');
  });

  it('shows the snap state and grid size in the Hammer wording', () => {
    const snap = statusBarTestFieldRead(statusBar, 'status-bar-snap');
    statusBar.setSnapInterval(0.25);
    statusBar.setSnapStatus(true);
    expect(snap.textContent).toBe(statusSnapFormat(true, '0.25'));
    expect(snap.textContent).toBe('Snap: On Grid: 0.25');
    statusBar.setSnapStatus(false);
    expect(snap.textContent).toBe(statusSnapFormat(false, '0.25'));
  });

  it('formats grid sizes without float noise and with fine steps kept', () => {
    const snap = statusBarTestFieldRead(statusBar, 'status-bar-snap');
    statusBar.setSnapStatus(true);
    statusBar.setSnapInterval(0.07);
    expect(snap.textContent).toBe(statusSnapFormat(true, '0.07'));
    statusBar.setSnapInterval(0.03125);
    expect(snap.textContent).toBe(statusSnapFormat(true, '0.03125'));
    statusBar.setSnapInterval(1);
    expect(snap.textContent).toBe(statusSnapFormat(true, '1.0'));
  });

  it('shows the 2D view zoom, and the empty marker while it is unknown', () => {
    const zoom = statusBarTestFieldRead(statusBar, 'status-bar-zoom');
    expect(zoom.textContent).toBe(statusZoomFormat(null));
    const zoomFactor = 2.5;
    statusBar.setViewZoom(zoomFactor);
    expect(zoom.textContent).toBe(statusZoomFormat(zoomFactor));
    expect(zoom.textContent).toContain('Zoom:');
    statusBar.setViewZoom(null);
    expect(zoom.textContent).toBe(statusZoomFormat(null));
  });

  it('keeps the selection mode in the selection field tooltip', () => {
    const selection = statusBarTestFieldRead(statusBar, 'status-bar-hammer-selection');
    statusBar.setSelectionModeInfo('Face', 4);
    expect(selection.title).toContain('Face');
    expect(selection.title).toContain('4');
    statusBar.setSelectionModeInfo('Object', 0);
    expect(selection.title).toBe('Selection: Object');
  });

  it('uses the theme UI font and the theme status bar background', () => {
    statusBar
      .getRootElement()
      .querySelectorAll<HTMLElement>('.status-bar-field')
      .forEach((field) => {
        expect(field.style.fontFamily).toBe(Theme.uiFontFamily);
      });
    const probe = document.createElement('div');
    probe.style.background = Theme.statusBarBackground;
    expect(statusBar.getRootElement().style.background).toBe(probe.style.background);
  });

  it('removes itself from the DOM on dispose', () => {
    const root = statusBar.getRootElement();
    expect(container.contains(root)).toBe(true);
    statusBar.dispose();
    expect(container.contains(root)).toBe(false);
  });
});
