import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShellFrame } from '@/layout/shell/frame/shell_frame.js';
import { ShellStateStore } from '@/layout/shell/state/shell_state_store.js';
import { shellTestStorageCreate } from '../shell_test_support.js';

/** One dock or bar the frame can show and hide. */
interface ShellFrameTestVisibilityCase {
  readonly name: string;
  readonly isVisible: (frame: ShellFrame) => boolean;
  readonly visibleSet: (frame: ShellFrame, visible: boolean) => void;
  readonly hostRead: (frame: ShellFrame) => HTMLElement;
}

/** The inspector, the info panel and the toolbar with their frame accessors. */
const SHELL_FRAME_TEST_VISIBILITY_CASES: readonly ShellFrameTestVisibilityCase[] = [
  {
    name: 'inspector',
    isVisible: (frame) => frame.isInspectorVisible(),
    visibleSet: (frame, visible) => frame.inspectorVisibleSet(visible),
    hostRead: (frame) => frame.inspectorHostRead(),
  },
  {
    name: 'info panel',
    isVisible: (frame) => frame.isInfoPanelVisible(),
    visibleSet: (frame, visible) => frame.infoPanelVisibleSet(visible),
    hostRead: (frame) => frame.infoPanelHostRead(),
  },
  {
    name: 'toolbar',
    isVisible: (frame) => frame.isToolbarVisible(),
    visibleSet: (frame, visible) => frame.toolbarVisibleSet(visible),
    hostRead: (frame) => frame.toolbarHostRead(),
  },
];

/**
 * Builds a frame in a mounted container over a store kept in the given storage.
 *
 * @param storage Storage the shell state is kept in.
 * @returns Frame, its container and its store.
 */
function shellFrameTestCreate(storage: Storage): {
  frame: ShellFrame;
  container: HTMLElement;
  stateStore: ShellStateStore;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const stateStore = new ShellStateStore(storage);
  return { frame: new ShellFrame(container, stateStore), container, stateStore };
}

/**
 * Returns the index of the root child that is or contains an element.
 *
 * @param root Frame root.
 * @param element Element inside the root.
 * @returns Index among the root children, or -1.
 */
function shellFrameTestRootChildIndex(root: HTMLElement, element: HTMLElement): number {
  return [...root.children].findIndex((child) => child === element || child.contains(element));
}

/**
 * Returns whether a host element is hidden by its own or an ancestor's inline
 * display.
 *
 * @param element Host element.
 * @returns True when the element or an ancestor has display none.
 */
function shellFrameTestIsHidden(element: HTMLElement): boolean {
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (current.style.display === 'none') {
      return true;
    }
  }
  return false;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('ShellFrame', () => {
  it('mounts its root inside the editor container', () => {
    const { frame, container } = shellFrameTestCreate(shellTestStorageCreate());
    expect(frame.getElement().parentElement).toBe(container);
  });

  it('places the menu bar host, then the toolbar host, then the docks', () => {
    const { frame } = shellFrameTestCreate(shellTestStorageCreate());
    const root = frame.getElement();
    const menuIndex = shellFrameTestRootChildIndex(root, frame.menuBarHostRead());
    const toolbarIndex = shellFrameTestRootChildIndex(root, frame.toolbarHostRead());
    const viewIndex = shellFrameTestRootChildIndex(root, frame.viewColumnRead());
    const inspectorIndex = shellFrameTestRootChildIndex(root, frame.inspectorHostRead());
    expect(menuIndex).toBeGreaterThanOrEqual(0);
    expect(toolbarIndex).toBe(menuIndex + 1);
    expect(viewIndex).toBeGreaterThan(toolbarIndex);
    expect(inspectorIndex).toBe(viewIndex);
  });

  it('nests the view column and the info panel beside the inspector', () => {
    const { frame } = shellFrameTestCreate(shellTestStorageCreate());
    const inspectorHost = frame.inspectorHostRead();
    const infoPanelHost = frame.infoPanelHostRead();
    const viewColumn = frame.viewColumnRead();
    expect(inspectorHost.contains(viewColumn)).toBe(false);
    expect(infoPanelHost.contains(viewColumn)).toBe(false);
    expect(inspectorHost.contains(infoPanelHost)).toBe(false);
    expect(viewColumn.parentElement?.parentElement).toBe(infoPanelHost.parentElement);
    expect(infoPanelHost.parentElement?.parentElement?.parentElement).toBe(inspectorHost.parentElement);
  });

  it('puts the view bar first in the view column with tool and workspace slots in order', () => {
    const { frame } = shellFrameTestCreate(shellTestStorageCreate());
    const viewBar = frame.viewColumnRead().firstElementChild;
    expect(viewBar?.classList.contains('shell-view-bar')).toBe(true);
    expect(viewBar?.children[0]).toBe(frame.viewBarToolSlotRead());
    expect(viewBar?.children[1]).toBe(frame.viewBarWorkspaceSlotRead());
  });

  SHELL_FRAME_TEST_VISIBILITY_CASES.forEach((testCase) => {
    it(`hides and shows the ${testCase.name} and remembers it in a fresh frame`, () => {
      const storage = shellTestStorageCreate();
      const first = shellFrameTestCreate(storage);
      expect(testCase.isVisible(first.frame)).toBe(true);
      testCase.visibleSet(first.frame, false);
      expect(testCase.isVisible(first.frame)).toBe(false);
      expect(shellFrameTestIsHidden(testCase.hostRead(first.frame))).toBe(true);
      first.frame.dispose();
      const second = shellFrameTestCreate(storage);
      expect(testCase.isVisible(second.frame)).toBe(false);
      expect(shellFrameTestIsHidden(testCase.hostRead(second.frame))).toBe(true);
      testCase.visibleSet(second.frame, true);
      expect(testCase.isVisible(second.frame)).toBe(true);
      expect(shellFrameTestIsHidden(testCase.hostRead(second.frame))).toBe(false);
    });

    it(`tells visibility listeners when the ${testCase.name} changes until they are removed`, () => {
      const { frame } = shellFrameTestCreate(shellTestStorageCreate());
      const listener = vi.fn();
      const listenerRemove = frame.visibilityListenerAdd(listener);
      testCase.visibleSet(frame, false);
      expect(listener).toHaveBeenCalledTimes(1);
      listenerRemove();
      testCase.visibleSet(frame, true);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  it('writes the visibility choices into the state store', () => {
    const { frame, stateStore } = shellFrameTestCreate(shellTestStorageCreate());
    frame.inspectorVisibleSet(false);
    frame.infoPanelVisibleSet(false);
    frame.toolbarVisibleSet(false);
    const state = stateStore.getState();
    expect(state.inspectorVisible).toBe(false);
    expect(state.infoPanelVisible).toBe(false);
    expect(state.toolbarVisible).toBe(false);
  });

  it('removes its root from the container and drops listeners on dispose', () => {
    const { frame, container } = shellFrameTestCreate(shellTestStorageCreate());
    const listener = vi.fn();
    frame.visibilityListenerAdd(listener);
    frame.dispose();
    expect(container.contains(frame.getElement())).toBe(false);
    expect(frame.getElement().isConnected).toBe(false);
    frame.toolbarVisibleSet(false);
    expect(listener).not.toHaveBeenCalled();
  });
});
