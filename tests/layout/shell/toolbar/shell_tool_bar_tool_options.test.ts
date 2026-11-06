import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toolbar } from '@/ui/toolbar/toolbar.js';
import { ShellToolBarBuilder, type ShellToolBarParts } from '@/layout/shell/toolbar/shell_tool_bar_builder.js';
import {
  ViewportToolChromeHost,
  type ViewportToolChromeHandlers,
} from '@/tools/chrome/host/viewport_tool_chrome_host.js';
import {
  TOOLBAR_OVERFLOW_ITEM_SELECTOR,
  TOOLBAR_OVERFLOW_PRIORITY_TOOL_OPTIONS,
  toolbarOverflowItemPriorityRead,
} from '@/ui/toolbar/overflow/toolbar_overflow_item.js';
import { EditorToolId } from '@/types/editor_tool_id.js';
import { ShellTestWindowActions, shellTestToolbarActionsCreate } from '../shell_test_support.js';

/** Toolbar row, its slots and the tool chrome docked into it. */
interface ShellToolBarToolOptionsTestRig {
  readonly toolbar: Toolbar;
  readonly parts: ShellToolBarParts;
  readonly host: ViewportToolChromeHost;
}

/** Rig built by the running test. */
let shellToolBarToolOptionsTestRig: ShellToolBarToolOptionsTestRig | null = null;

/**
 * Creates chrome handlers where every required callback is a spy.
 *
 * @returns Chrome handlers.
 */
function shellToolBarToolOptionsTestHandlersCreate(): ViewportToolChromeHandlers {
  return {
    onSelectTool: vi.fn(),
    onTransformMode: vi.fn(),
    onFlipClipPlane: vi.fn(),
    onCommitClip: vi.fn(),
    onCommitSplit: vi.fn(),
    faceInspectorReveal: vi.fn(),
    onExtrudeFaces: vi.fn(),
    onGridReset: vi.fn(),
    onGridAlignToFace: vi.fn(),
    onGridAlignAxis: vi.fn(),
    onGridOriginVertex: vi.fn(),
    onCameraReset: vi.fn(),
    onCameraAlignToFace: vi.fn(),
    onInteractionMode: vi.fn(),
    onComponentMode: vi.fn(),
  };
}

/**
 * Builds the main toolbar row and docks the tool options into its slot.
 *
 * @returns Test rig.
 */
function shellToolBarToolOptionsTestRigCreate(): ShellToolBarToolOptionsTestRig {
  const container = document.createElement('div');
  const railParent = document.createElement('div');
  document.body.append(container, railParent);
  const toolbar = new Toolbar(container);
  const parts = new ShellToolBarBuilder().build(toolbar, shellTestToolbarActionsCreate(), new ShellTestWindowActions());
  const host = ViewportToolChromeHost.dockedCreate(
    { railParent, optionsParent: parts.toolOptionsSlot },
    shellToolBarToolOptionsTestHandlersCreate(),
  );
  shellToolBarToolOptionsTestRig = { toolbar, parts, host };
  return shellToolBarToolOptionsTestRig;
}

/**
 * Returns the accessible names of the shown buttons inside an element.
 *
 * @param element Element holding the buttons.
 * @returns Button names in document order.
 */
function shellToolBarToolOptionsTestButtonNamesRead(element: HTMLElement): string[] {
  return Array.from(element.querySelectorAll('button')).map(
    (button) => button.getAttribute('aria-label') ?? (button.textContent ?? '').trim(),
  );
}

afterEach(() => {
  shellToolBarToolOptionsTestRig?.host.dispose();
  shellToolBarToolOptionsTestRig?.toolbar.dispose();
  shellToolBarToolOptionsTestRig = null;
  document.body.replaceChildren();
});

describe('ShellToolBarBuilder tool options slot', () => {
  it('holds the global actions and the active tool options in one toolbar row', () => {
    const { toolbar, parts } = shellToolBarToolOptionsTestRigCreate();
    const rowNames = shellToolBarToolOptionsTestButtonNamesRead(toolbar.getElement());
    const optionNames = shellToolBarToolOptionsTestButtonNamesRead(parts.toolOptionsSlot);
    expect(rowNames).toContain('Undo');
    expect(optionNames.length).toBeGreaterThan(0);
    optionNames.forEach((name) => expect(rowNames).toContain(name));
    expect(toolbar.getElement().contains(parts.toolOptionsSlot)).toBe(true);
  });

  it('swaps the options in the row when the active tool changes and keeps the global actions', () => {
    const { toolbar, parts, host } = shellToolBarToolOptionsTestRigCreate();
    host.setActiveTool(EditorToolId.OBJECT);
    const objectOptions = shellToolBarToolOptionsTestButtonNamesRead(parts.toolOptionsSlot);
    host.setActiveTool(EditorToolId.CLIP_PLANE);
    const clipOptions = shellToolBarToolOptionsTestButtonNamesRead(parts.toolOptionsSlot);
    expect(clipOptions).not.toEqual(objectOptions);
    expect(clipOptions.some((name) => !objectOptions.includes(name))).toBe(true);
    expect(shellToolBarToolOptionsTestButtonNamesRead(toolbar.getElement())).toContain('Undo');
    host.setActiveTool(EditorToolId.OBJECT);
    expect(shellToolBarToolOptionsTestButtonNamesRead(parts.toolOptionsSlot)).toEqual(objectOptions);
  });

  it('marks every tool option control as collapsing after the global actions', () => {
    const { parts, host } = shellToolBarToolOptionsTestRigCreate();
    host.setActiveTool(EditorToolId.CLIP_PLANE);
    const markedOptions = Array.from(
      parts.toolOptionsSlot.querySelectorAll<HTMLElement>(TOOLBAR_OVERFLOW_ITEM_SELECTOR),
    );
    expect(markedOptions.length).toBeGreaterThan(0);
    markedOptions.forEach((item) =>
      expect(toolbarOverflowItemPriorityRead(item)).toBe(TOOLBAR_OVERFLOW_PRIORITY_TOOL_OPTIONS),
    );
  });
});
