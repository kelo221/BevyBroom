import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HandlerSolidBrushTools } from '@/tools/csg/solid/handler_solid_brush_tools.js';
import { Toolbar } from '@/ui/toolbar/toolbar.js';
import { SHELL_TOOL_BAR_TOOL_SLOT_CLASS, ShellToolBarBuilder } from '@/layout/shell/toolbar/shell_tool_bar_builder.js';
import { formatGridIntervalLabel } from '@/layout/shell/toolbar/shell_grid_interval_label.js';
import { SNAP_PRESETS } from '@/types/snap_presets.js';
import {
  ShellTestWindowActions,
  shellTestToolbarActionsCreate,
  type ShellTestToolbarActions,
} from '../shell_test_support.js';

/** Toolbar, its actions and the tool slot built for one test. */
interface ShellToolBarBuilderTestRig {
  readonly toolbar: Toolbar;
  readonly toolbarActions: ShellTestToolbarActions;
  readonly windowActions: ShellTestWindowActions;
  readonly toolSlot: HTMLElement;
}

/** Toolbar built by the running test. */
let shellToolBarBuilderTestToolbar: Toolbar | null = null;

/**
 * Builds a mounted toolbar filled by the shell toolbar builder.
 *
 * @param toolbarActions Toolbar actions the buttons run.
 * @param windowActions Window actions for the grid size.
 * @returns Test rig.
 */
function shellToolBarBuilderTestRigCreate(
  toolbarActions: ShellTestToolbarActions = shellTestToolbarActionsCreate(),
  windowActions: ShellTestWindowActions = new ShellTestWindowActions(),
): ShellToolBarBuilderTestRig {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const toolbar = new Toolbar(container);
  shellToolBarBuilderTestToolbar = toolbar;
  const toolSlot = new ShellToolBarBuilder().build(toolbar, toolbarActions, windowActions);
  return { toolbar, toolbarActions, windowActions, toolSlot };
}

/**
 * Returns the accessible label of a toolbar button.
 *
 * @param button Toolbar button.
 * @returns Aria-label, or the title, or the text.
 */
function shellToolBarBuilderTestButtonLabelRead(button: Element): string {
  return button.getAttribute('aria-label') ?? button.getAttribute('title') ?? button.textContent ?? '';
}

/**
 * Returns the toolbar button whose accessible label or visible text equals a
 * label.
 *
 * @param toolbar Toolbar holding the button.
 * @param label Accessible label or visible text.
 * @returns Button element.
 */
function shellToolBarBuilderTestButtonRead(toolbar: Toolbar, label: string): HTMLButtonElement {
  const button = [...toolbar.getElement().querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) =>
      shellToolBarBuilderTestButtonLabelRead(candidate) === label || (candidate.textContent ?? '').trim() === label,
  );
  if (!button) {
    throw new Error(`Toolbar button ${label} not found`);
  }
  return button;
}

/**
 * Returns the visible label text of a dropdown header without its caret.
 *
 * @param header Dropdown header button.
 * @returns Text of the header's leading text node.
 */
function shellToolBarBuilderTestHeaderTextRead(header: HTMLButtonElement): string {
  const first = header.firstChild;
  return first && first.nodeType === Node.TEXT_NODE ? (first.textContent ?? '') : '';
}

/**
 * Returns the index of the direct toolbar child that is or contains an element.
 *
 * @param toolbar Toolbar.
 * @param element Element inside the toolbar.
 * @returns Child index, or -1.
 */
function shellToolBarBuilderTestChildIndex(toolbar: Toolbar, element: Element): number {
  return [...toolbar.getElement().children].findIndex((child) => child === element || child.contains(element));
}

/**
 * Opens a dropdown header and returns its open panel.
 *
 * @param header Dropdown header button.
 * @returns Open menu panel.
 */
function shellToolBarBuilderTestDropdownOpen(header: HTMLButtonElement): HTMLElement {
  header.click();
  const panel = document.body.querySelector<HTMLElement>('.editor-toolbar-dropdown-menu[style*="display: block"]');
  if (!panel) {
    throw new Error('No open menu panel');
  }
  return panel;
}

afterEach(() => {
  shellToolBarBuilderTestToolbar?.dispose();
  shellToolBarBuilderTestToolbar = null;
  document.body.replaceChildren();
});

describe('ShellToolBarBuilder', () => {
  it('returns the tool slot attached in the toolbar after the history buttons', () => {
    const { toolbar, toolSlot } = shellToolBarBuilderTestRigCreate();
    expect(toolSlot.parentElement).toBe(toolbar.getElement());
    expect(toolSlot.classList.contains(SHELL_TOOL_BAR_TOOL_SLOT_CLASS)).toBe(true);
    const slotIndex = shellToolBarBuilderTestChildIndex(toolbar, toolSlot);
    expect(shellToolBarBuilderTestChildIndex(toolbar, shellToolBarBuilderTestButtonRead(toolbar, 'Redo'))).toBeLessThan(
      slotIndex,
    );
    expect(
      shellToolBarBuilderTestChildIndex(toolbar, shellToolBarBuilderTestButtonRead(toolbar, 'Snap')),
    ).toBeGreaterThan(slotIndex);
  });

  it('runs undo and redo from their buttons', () => {
    const { toolbar, toolbarActions } = shellToolBarBuilderTestRigCreate();
    shellToolBarBuilderTestButtonRead(toolbar, 'Undo').click();
    shellToolBarBuilderTestButtonRead(toolbar, 'Redo').click();
    expect(toolbarActions.onUndo).toHaveBeenCalledTimes(1);
    expect(toolbarActions.onRedo).toHaveBeenCalledTimes(1);
  });

  it('runs duplicate and both flips from the object edit buttons', () => {
    const windowActions = new ShellTestWindowActions();
    const flip = vi.fn(() => null);
    windowActions.solidBrushTools = { flip } as unknown as HandlerSolidBrushTools;
    const { toolbar, toolbarActions } = shellToolBarBuilderTestRigCreate(undefined, windowActions);
    shellToolBarBuilderTestButtonRead(toolbar, 'Duplicate').click();
    shellToolBarBuilderTestButtonRead(toolbar, 'Flip Horizontally').click();
    shellToolBarBuilderTestButtonRead(toolbar, 'Flip Vertically').click();
    expect(toolbarActions.onDuplicateSelected).toHaveBeenCalledOnce();
    expect(flip).toHaveBeenNthCalledWith(1, 'horizontal');
    expect(flip).toHaveBeenNthCalledWith(2, 'vertical');
  });

  it('has no object creation buttons, which live in the Add menu', () => {
    const { toolbar } = shellToolBarBuilderTestRigCreate();
    const labels = [...toolbar.getElement().querySelectorAll('button')].map(shellToolBarBuilderTestButtonLabelRead);
    expect(labels.filter((label) => label.startsWith('Add'))).toEqual([]);
  });

  it('labels the grid dropdown with the current grid size', () => {
    const windowActions = new ShellTestWindowActions();
    windowActions.gridInterval = SNAP_PRESETS[2] ?? 0.125;
    const { toolbar } = shellToolBarBuilderTestRigCreate(shellTestToolbarActionsCreate(), windowActions);
    const gridHeader = shellToolBarBuilderTestButtonRead(toolbar, 'Grid Size');
    expect(shellToolBarBuilderTestHeaderTextRead(gridHeader)).toBe(formatGridIntervalLabel(windowActions.gridInterval));
  });

  it('updates the grid dropdown label when the registered grid size listener fires', () => {
    const { toolbar, windowActions } = shellToolBarBuilderTestRigCreate();
    expect(windowActions.gridIntervalListenerCount()).toBe(1);
    const gridHeader = shellToolBarBuilderTestButtonRead(toolbar, 'Grid Size');
    const childCountBefore = gridHeader.childNodes.length;
    const nextInterval = SNAP_PRESETS.find((interval) => interval !== windowActions.gridInterval) ?? 2;
    windowActions.gridIntervalChange(nextInterval);
    expect(shellToolBarBuilderTestHeaderTextRead(gridHeader)).toBe(formatGridIntervalLabel(nextInterval));
    expect(gridHeader.title).toBe(formatGridIntervalLabel(nextInterval));
    expect(gridHeader.childNodes.length).toBe(childCountBefore);
  });

  it('lists every preset in the grid dropdown and sets the grid size from a row', () => {
    const { toolbar, windowActions } = shellToolBarBuilderTestRigCreate();
    const panel = shellToolBarBuilderTestDropdownOpen(shellToolBarBuilderTestButtonRead(toolbar, 'Grid Size'));
    const rowTexts = [...panel.querySelectorAll('button')].map((row) => row.textContent ?? '');
    SNAP_PRESETS.forEach((interval) => {
      expect(rowTexts.some((text) => text.includes(formatGridIntervalLabel(interval)))).toBe(true);
    });
    const lastPreset = SNAP_PRESETS[SNAP_PRESETS.length - 1] ?? 1;
    const lastRow = [...panel.querySelectorAll('button')].find((row) =>
      (row.textContent ?? '').includes(formatGridIntervalLabel(lastPreset)),
    );
    lastRow?.click();
    expect(windowActions.gridIntervalSet).toHaveBeenCalledWith(lastPreset);
  });

  it('highlights snap, gizmo axes and texture locks from the toolbar state', () => {
    const toolbarActions = shellTestToolbarActionsCreate({
      isUserSnapEnabled: () => true,
      isTransformSpaceLocal: () => true,
      isPositionLockEnabled: () => false,
      isStretchLockEnabled: () => true,
    });
    const { toolbar } = shellToolBarBuilderTestRigCreate(toolbarActions);
    const activeRead = (label: string) => shellToolBarBuilderTestButtonRead(toolbar, label).dataset['active'];
    expect(activeRead('Snap')).toBe('true');
    expect(activeRead('Global')).toBe('false');
    expect(activeRead('Local')).toBe('true');
    expect(activeRead('Pos Lock')).toBe('false');
    expect(activeRead('Stretch Lock')).toBe('true');
  });

  it('runs the snap, gizmo axes and texture lock actions from their buttons', () => {
    const { toolbar, toolbarActions } = shellToolBarBuilderTestRigCreate();
    shellToolBarBuilderTestButtonRead(toolbar, 'Snap').click();
    shellToolBarBuilderTestButtonRead(toolbar, 'Global').click();
    shellToolBarBuilderTestButtonRead(toolbar, 'Local').click();
    expect(toolbarActions.onToggleSnap).toHaveBeenCalledTimes(1);
    expect(toolbarActions.onSetTransformSpaceGlobal).toHaveBeenCalledTimes(1);
    expect(toolbarActions.onSetTransformSpaceLocal).toHaveBeenCalledTimes(1);
  });

  it('places the MCP button last after the trailing spacer, inactive until the server runs', () => {
    const { toolbar, toolbarActions } = shellToolBarBuilderTestRigCreate();
    const children = [...toolbar.getElement().children];
    const spacerIndex = children.findIndex(
      (child) => child instanceof HTMLElement && child.dataset['toolbarTrailingSpacer'] === 'true',
    );
    const mcpButton = shellToolBarBuilderTestButtonRead(toolbar, 'MCP');
    const buttons = [...toolbar.getElement().querySelectorAll('button')];
    expect(buttons[buttons.length - 1]).toBe(mcpButton);
    expect(spacerIndex).toBeGreaterThanOrEqual(0);
    expect(shellToolBarBuilderTestChildIndex(toolbar, mcpButton)).toBeGreaterThan(spacerIndex);
    expect(mcpButton.dataset['active']).toBe('false');
    mcpButton.click();
    expect(toolbarActions.onOpenMcpDialog).toHaveBeenCalledTimes(1);
  });
});
