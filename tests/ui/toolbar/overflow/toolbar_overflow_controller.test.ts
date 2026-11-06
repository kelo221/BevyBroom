import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ToolbarOverflowController,
  toolbarOverflowSeparatorsTidy,
} from '@/ui/toolbar/overflow/toolbar_overflow_controller.js';
import {
  TOOLBAR_OVERFLOW_PRIORITY_GLOBAL,
  TOOLBAR_OVERFLOW_PRIORITY_TOOL_OPTIONS,
  TOOLBAR_OVERFLOW_PRIORITY_TRAILING,
  toolbarOverflowItemMark,
} from '@/ui/toolbar/overflow/toolbar_overflow_item.js';
import type { ToolbarOverflowMeasure } from '@/ui/toolbar/overflow/toolbar_overflow_measure.js';
import { isMenuAction, type ToolbarMenuEntry } from '@/ui/menu/menu_types.js';

/** Dataset key holding the stub width of a test item. */
const TOOLBAR_OVERFLOW_TEST_WIDTH_KEY = 'testWidth';

/** Number of items the test rig adds to its row. */
const TOOLBAR_OVERFLOW_TEST_ITEM_COUNT = 5;

/** Stub width of every test item. */
const TOOLBAR_OVERFLOW_TEST_ITEM_WIDTH = 30;

/**
 * Row width check that adds the stub widths of the shown marked items and
 * compares them with an adjustable row width.
 */
class ToolbarOverflowTestMeasure implements ToolbarOverflowMeasure {
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
   * @returns True when the summed stub widths exceed the row width.
   */
  rowIsOverflowing(row: HTMLElement): boolean {
    const shownWidth = Array.from(row.querySelectorAll<HTMLElement>('[data-test-width]'))
      .filter((item) => item.style.display !== 'none')
      .reduce((sum, item) => sum + Number(item.dataset[TOOLBAR_OVERFLOW_TEST_WIDTH_KEY]), 0);
    return shownWidth > this.rowWidth;
  }
}

/** Row, trigger, items and measure of one test. */
interface ToolbarOverflowTestRig {
  readonly row: HTMLElement;
  readonly trigger: HTMLElement;
  readonly measure: ToolbarOverflowTestMeasure;
  readonly controller: ToolbarOverflowController;
  readonly items: HTMLButtonElement[];
}

/** Controller built by the running test. */
let toolbarOverflowTestController: ToolbarOverflowController | null = null;

/**
 * Appends one named button marked with a collapse rank and a stub width.
 *
 * @param row Toolbar row.
 * @param label Button name.
 * @param priority Collapse rank.
 * @returns Button.
 */
function toolbarOverflowTestItemAdd(row: HTMLElement, label: string, priority: number): HTMLButtonElement {
  const button = document.createElement('button');
  button.setAttribute('aria-label', label);
  button.dataset[TOOLBAR_OVERFLOW_TEST_WIDTH_KEY] = String(TOOLBAR_OVERFLOW_TEST_ITEM_WIDTH);
  toolbarOverflowItemMark(button, priority);
  row.appendChild(button);
  return button;
}

/**
 * Builds a row with two global items, two tool option items and one trailing
 * item, all of the same stub width.
 *
 * @param rowWidth Width available to the items.
 * @returns Test rig.
 */
function toolbarOverflowTestRigCreate(rowWidth: number): ToolbarOverflowTestRig {
  const row = document.createElement('div');
  const trigger = document.createElement('div');
  document.body.appendChild(row);
  const items = [
    toolbarOverflowTestItemAdd(row, 'Undo', TOOLBAR_OVERFLOW_PRIORITY_GLOBAL),
    toolbarOverflowTestItemAdd(row, 'Redo', TOOLBAR_OVERFLOW_PRIORITY_GLOBAL),
    toolbarOverflowTestItemAdd(row, 'Move', TOOLBAR_OVERFLOW_PRIORITY_TOOL_OPTIONS),
    toolbarOverflowTestItemAdd(row, 'Rotate', TOOLBAR_OVERFLOW_PRIORITY_TOOL_OPTIONS),
    toolbarOverflowTestItemAdd(row, 'MCP', TOOLBAR_OVERFLOW_PRIORITY_TRAILING),
  ];
  row.appendChild(trigger);
  const measure = new ToolbarOverflowTestMeasure(rowWidth);
  const controller = new ToolbarOverflowController(row, trigger, measure);
  toolbarOverflowTestController = controller;
  return { row, trigger, measure, controller, items };
}

/**
 * Returns the labels of the action rows among entries.
 *
 * @param entries Menu entries.
 * @returns Labels in order.
 */
function toolbarOverflowTestLabelsRead(entries: readonly ToolbarMenuEntry[]): string[] {
  return entries.flatMap((entry) => (isMenuAction(entry) ? [entry.label] : []));
}

afterEach(() => {
  toolbarOverflowTestController?.dispose();
  toolbarOverflowTestController = null;
  document.body.replaceChildren();
});

describe('ToolbarOverflowController', () => {
  it('hides nothing and hides the trigger while every item fits', () => {
    const rig = toolbarOverflowTestRigCreate(TOOLBAR_OVERFLOW_TEST_ITEM_WIDTH * TOOLBAR_OVERFLOW_TEST_ITEM_COUNT);
    rig.controller.refresh();
    expect(rig.controller.collapsedItemsRead()).toEqual([]);
    expect(rig.trigger.style.display).toBe('none');
  });

  it('collapses global actions first, then the rightmost tool option, until the row fits', () => {
    const rig = toolbarOverflowTestRigCreate(TOOLBAR_OVERFLOW_TEST_ITEM_WIDTH * 2);
    rig.controller.refresh();
    const labels = rig.controller.collapsedItemsRead().map((item) => item.getAttribute('aria-label'));
    expect(labels).toEqual(['Undo', 'Redo', 'Rotate']);
    expect(rig.trigger.style.display).not.toBe('none');
    expect(rig.measure.rowIsOverflowing(rig.row)).toBe(false);
  });

  it('collapses only the rightmost global action when one item is too many', () => {
    const rig = toolbarOverflowTestRigCreate(TOOLBAR_OVERFLOW_TEST_ITEM_WIDTH * (TOOLBAR_OVERFLOW_TEST_ITEM_COUNT - 1));
    rig.controller.refresh();
    expect(rig.controller.collapsedItemsRead().map((item) => item.getAttribute('aria-label'))).toEqual(['Redo']);
  });

  it('lists the collapsed items in the overflow menu and runs them from there', () => {
    const rig = toolbarOverflowTestRigCreate(TOOLBAR_OVERFLOW_TEST_ITEM_WIDTH * 3);
    const onRedo = vi.fn();
    rig.items[1]?.addEventListener('click', onRedo);
    rig.controller.refresh();
    const entries = rig.controller.menuEntriesBuild();
    expect(toolbarOverflowTestLabelsRead(entries)).toEqual(['Undo', 'Redo']);
    const redoRow = entries.find((entry) => isMenuAction(entry) && entry.label === 'Redo');
    if (!redoRow || !isMenuAction(redoRow)) {
      throw new Error('Redo row missing');
    }
    redoRow.onClick();
    expect(onRedo).toHaveBeenCalledOnce();
  });

  it('uses the registered entries of an item instead of its buttons', () => {
    const rig = toolbarOverflowTestRigCreate(0);
    const dropdown = document.createElement('div');
    dropdown.dataset[TOOLBAR_OVERFLOW_TEST_WIDTH_KEY] = String(TOOLBAR_OVERFLOW_TEST_ITEM_WIDTH);
    toolbarOverflowItemMark(dropdown, TOOLBAR_OVERFLOW_PRIORITY_GLOBAL, () => [
      { kind: 'submenu', label: 'Grid Size', children: [] },
    ]);
    rig.row.prepend(dropdown);
    rig.controller.refresh();
    const entries = rig.controller.menuEntriesBuild();
    expect(entries[0]).toEqual(expect.objectContaining({ kind: 'submenu', label: 'Grid Size' }));
  });

  it('shows every item again when the row grows', () => {
    const rig = toolbarOverflowTestRigCreate(TOOLBAR_OVERFLOW_TEST_ITEM_WIDTH);
    rig.controller.refresh();
    expect(rig.controller.collapsedItemsRead().length).toBeGreaterThan(0);
    rig.measure.rowWidth = TOOLBAR_OVERFLOW_TEST_ITEM_WIDTH * TOOLBAR_OVERFLOW_TEST_ITEM_COUNT;
    rig.controller.refresh();
    expect(rig.controller.collapsedItemsRead()).toEqual([]);
    rig.items.forEach((item) => expect(item.style.display).not.toBe('none'));
    expect(rig.trigger.style.display).toBe('none');
  });

  it('leaves items hidden by their owners out of the menu and keeps them hidden', () => {
    const rig = toolbarOverflowTestRigCreate(0);
    const ownerHidden = rig.items[2];
    if (!ownerHidden) {
      throw new Error('Item missing');
    }
    ownerHidden.style.display = 'none';
    rig.controller.refresh();
    expect(rig.controller.collapsedItemsRead()).not.toContain(ownerHidden);
    rig.controller.dispose();
    expect(ownerHidden.style.display).toBe('none');
  });
});

describe('toolbarOverflowSeparatorsTidy', () => {
  it('drops leading, trailing and repeated separators', () => {
    const action = { label: 'Snap', onClick: () => undefined };
    const tidy = toolbarOverflowSeparatorsTidy([
      { kind: 'separator' },
      action,
      { kind: 'separator' },
      { kind: 'separator' },
      action,
      { kind: 'separator' },
    ]);
    expect(tidy).toEqual([action, { kind: 'separator' }, action]);
  });
});
