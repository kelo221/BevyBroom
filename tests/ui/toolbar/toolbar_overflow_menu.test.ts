import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOOLBAR_OVERFLOW_TRIGGER_CLASS, Toolbar } from '@/ui/toolbar/toolbar.js';
import type { ToolbarOverflowMeasure } from '@/ui/toolbar/overflow/toolbar_overflow_measure.js';
import { TOOLBAR_OVERFLOW_ITEM_SELECTOR } from '@/ui/toolbar/overflow/toolbar_overflow_item.js';

/** Stub width of every toolbar item in the tests. */
const TOOLBAR_OVERFLOW_MENU_TEST_ITEM_WIDTH = 24;

/**
 * Row width check that gives every shown marked item the same stub width and
 * compares the sum with an adjustable row width.
 */
class ToolbarOverflowMenuTestMeasure implements ToolbarOverflowMeasure {
  rowWidth: number;

  /**
   * Creates the measure.
   *
   * @param rowWidth Width available to the items.
   */
  constructor(rowWidth: number) {
    this.rowWidth = rowWidth;
  }

  /**
   * Returns whether the shown items are wider than the row.
   *
   * @param row Toolbar row.
   * @returns True when the stub widths exceed the row width.
   */
  rowIsOverflowing(row: HTMLElement): boolean {
    const shownCount = Array.from(row.querySelectorAll<HTMLElement>(TOOLBAR_OVERFLOW_ITEM_SELECTOR)).filter(
      (item) => item.style.display !== 'none',
    ).length;
    return shownCount * TOOLBAR_OVERFLOW_MENU_TEST_ITEM_WIDTH > this.rowWidth;
  }
}

/** Toolbar built by the running test. */
let toolbarOverflowMenuTestToolbar: Toolbar | null = null;

/**
 * Builds a mounted toolbar.
 *
 * @returns Toolbar.
 */
function toolbarOverflowMenuTestToolbarCreate(): Toolbar {
  const container = document.createElement('div');
  document.body.appendChild(container);
  toolbarOverflowMenuTestToolbar = new Toolbar(container);
  return toolbarOverflowMenuTestToolbar;
}

/**
 * Returns the overflow trigger button of a toolbar.
 *
 * @param toolbar Toolbar holding the trigger.
 * @returns Trigger button.
 */
function toolbarOverflowMenuTestTriggerRead(toolbar: Toolbar): HTMLButtonElement {
  const trigger = toolbar.getElement().querySelector<HTMLButtonElement>(`.${TOOLBAR_OVERFLOW_TRIGGER_CLASS} button`);
  if (!trigger) {
    throw new Error('Overflow trigger missing');
  }
  return trigger;
}

afterEach(() => {
  toolbarOverflowMenuTestToolbar?.dispose();
  toolbarOverflowMenuTestToolbar = null;
  document.body.replaceChildren();
});

describe('Toolbar overflow menu', () => {
  it('hides the trigger while every button fits', () => {
    const toolbar = toolbarOverflowMenuTestToolbarCreate();
    ['Undo', 'Redo'].forEach((label) => toolbar.addButton(label, () => undefined));
    const measure = new ToolbarOverflowMenuTestMeasure(TOOLBAR_OVERFLOW_MENU_TEST_ITEM_WIDTH * 10);
    const controller = toolbar.addOverflowMenu(measure);
    controller.refresh();
    expect(controller.collapsedItemsRead()).toEqual([]);
    expect(toolbarOverflowMenuTestTriggerRead(toolbar).parentElement?.style.display).toBe('none');
  });

  it('moves the buttons that do not fit into the trigger menu and runs them from it', () => {
    const toolbar = toolbarOverflowMenuTestToolbarCreate();
    const onRedo = vi.fn();
    toolbar.addButton('Undo', () => undefined);
    toolbar.addButton('Redo', onRedo);
    toolbar.addButton('Snap', () => undefined);
    const measure = new ToolbarOverflowMenuTestMeasure(TOOLBAR_OVERFLOW_MENU_TEST_ITEM_WIDTH);
    const controller = toolbar.addOverflowMenu(measure);
    controller.refresh();
    const collapsedLabels = controller.collapsedItemsRead().map((item) => (item.textContent ?? '').trim());
    expect(collapsedLabels).toEqual(['Redo', 'Snap']);
    const trigger = toolbarOverflowMenuTestTriggerRead(toolbar);
    expect(trigger.parentElement?.style.display).not.toBe('none');
    trigger.click();
    const menu = document.body.querySelector<HTMLElement>('.editor-toolbar-dropdown-menu[style*="display: block"]');
    if (!menu) {
      throw new Error('Overflow menu did not open');
    }
    const redoRow = Array.from(menu.querySelectorAll('button')).find((row) => (row.textContent ?? '').includes('Redo'));
    redoRow?.click();
    expect(onRedo).toHaveBeenCalledOnce();
  });

  it('keeps the trigger itself out of the collapsible items', () => {
    const toolbar = toolbarOverflowMenuTestToolbarCreate();
    toolbar.addButton('Undo', () => undefined);
    const controller = toolbar.addOverflowMenu(new ToolbarOverflowMenuTestMeasure(0));
    controller.refresh();
    const trigger = toolbarOverflowMenuTestTriggerRead(toolbar);
    expect(controller.collapsedItemsRead().some((item) => item.contains(trigger))).toBe(false);
  });
});
