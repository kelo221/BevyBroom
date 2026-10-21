import { afterEach, describe, expect, it } from 'vitest';
import {
  SHELL_INSPECTOR_TABS,
  ShellInspector,
  type ShellInspectorSlot,
  type ShellInspectorTabId,
} from '@/layout/shell/inspector/shell_inspector.js';
import { ShellStateStore } from '@/layout/shell/state/shell_state_store.js';
import { shellStateDefaultCreate } from '@/layout/shell/state/shell_state.js';
import { shellTestStorageCreate } from '../shell_test_support.js';

/** Every inspector slot with the tab whose page holds it. */
const SHELL_INSPECTOR_TEST_SLOTS: ReadonlyArray<readonly [ShellInspectorSlot, ShellInspectorTabId]> = [
  ['map_layers', 'map'],
  ['map_outliner', 'map'],
  ['entity_properties', 'entity'],
  ['entity_browser', 'entity'],
  ['face', 'face'],
];

/**
 * Builds a mounted inspector over a store kept in the given storage.
 *
 * @param storage Storage the shell state is kept in.
 * @returns Inspector and its store.
 */
function shellInspectorTestCreate(storage: Storage): { inspector: ShellInspector; stateStore: ShellStateStore } {
  const stateStore = new ShellStateStore(storage);
  const inspector = new ShellInspector(stateStore);
  document.body.appendChild(inspector.getElement());
  return { inspector, stateStore };
}

/**
 * Returns the page of one inspector tab.
 *
 * @param inspector Inspector holding the page.
 * @param tabId Tab id.
 * @returns Page element.
 */
function shellInspectorTestPageRead(inspector: ShellInspector, tabId: ShellInspectorTabId): HTMLElement {
  const page = inspector.pageRead(tabId);
  if (!page) {
    throw new Error(`Inspector page ${tabId} not found`);
  }
  return page;
}

/**
 * Reads the fixed pixel size from a sized splitter pane's flex style.
 *
 * @param pane Sized splitter pane.
 * @returns Flex basis in CSS pixels.
 */
function shellInspectorTestPaneSizeRead(pane: HTMLElement): number {
  const match = /^0 0 (\d+(?:\.\d+)?)px$/.exec(pane.style.flex);
  if (!match || match[1] === undefined) {
    throw new Error(`Pane flex ${pane.style.flex} is not a fixed size`);
  }
  return Number(match[1]);
}

/**
 * Drags the splitter divider that sits right after a pane along the vertical
 * axis.
 *
 * @param pane First pane of the splitter.
 * @param travelPx Pointer travel in CSS pixels.
 */
function shellInspectorTestDividerDragAfter(pane: HTMLElement, travelPx: number): void {
  const divider = pane.nextElementSibling;
  if (!(divider instanceof HTMLElement) || !divider.classList.contains('splitter-box-divider')) {
    throw new Error('No splitter divider after the pane');
  }
  const start = 300;
  divider.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerId: 5, clientX: 0, clientY: start }));
  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 5, clientX: 0, clientY: start + travelPx }));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 5, clientX: 0, clientY: start + travelPx }));
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('ShellInspector', () => {
  it('offers the Map, Entity and Face tabs in that order', () => {
    const { inspector } = shellInspectorTestCreate(shellTestStorageCreate());
    const tabIds = [...inspector.getElement().querySelectorAll<HTMLElement>('[role="tab"]')].map(
      (button) => button.dataset['tabId'],
    );
    expect(tabIds).toEqual(['map', 'entity', 'face']);
    expect(SHELL_INSPECTOR_TABS.map((tab) => tab.label)).toEqual(['Map', 'Entity', 'Face']);
    expect(inspector.getElement().classList.contains('shell-inspector')).toBe(true);
  });

  it('starts on the default tab when nothing is stored', () => {
    const { inspector } = shellInspectorTestCreate(shellTestStorageCreate());
    expect(inspector.activeTabIdRead()).toBe(shellStateDefaultCreate().inspectorTabId);
  });

  it('returns a distinct element for every slot, held inside its tab page', () => {
    const { inspector } = shellInspectorTestCreate(shellTestStorageCreate());
    const slotElements = SHELL_INSPECTOR_TEST_SLOTS.map(([slot]) => inspector.slotRead(slot));
    expect(new Set(slotElements).size).toBe(SHELL_INSPECTOR_TEST_SLOTS.length);
    SHELL_INSPECTOR_TEST_SLOTS.forEach(([slot, tabId]) => {
      expect(shellInspectorTestPageRead(inspector, tabId).contains(inspector.slotRead(slot))).toBe(true);
    });
  });

  it('attaches every slot to the document once its tab is shown', () => {
    const { inspector } = shellInspectorTestCreate(shellTestStorageCreate());
    SHELL_INSPECTOR_TEST_SLOTS.forEach(([slot, tabId]) => {
      inspector.tabShow(tabId);
      const element = inspector.slotRead(slot);
      expect(element.isConnected).toBe(true);
      expect(element.closest('[hidden]')).toBeNull();
    });
  });

  it('keeps the two panes of a split page in separate splitter panes', () => {
    const { inspector } = shellInspectorTestCreate(shellTestStorageCreate());
    const layers = inspector.slotRead('map_layers');
    const outliner = inspector.slotRead('map_outliner');
    expect(layers.parentElement).toBe(outliner.parentElement);
    expect(layers.parentElement?.classList.contains('splitter-box')).toBe(true);
  });

  it('remembers the shown tab and restores it in a fresh inspector', () => {
    const storage = shellTestStorageCreate();
    const first = shellInspectorTestCreate(storage);
    first.inspector.tabShow('face');
    expect(first.stateStore.getState().inspectorTabId).toBe('face');
    first.inspector.dispose();
    const second = shellInspectorTestCreate(storage);
    expect(second.inspector.activeTabIdRead()).toBe('face');
  });

  it('remembers a dragged inner splitter size and restores it in a fresh inspector', () => {
    const storage = shellTestStorageCreate();
    const first = shellInspectorTestCreate(storage);
    const layersPane = first.inspector.slotRead('map_layers');
    const sizeBefore = shellInspectorTestPaneSizeRead(layersPane);
    shellInspectorTestDividerDragAfter(layersPane, 60);
    const sizeAfter = shellInspectorTestPaneSizeRead(layersPane);
    expect(sizeAfter).toBe(sizeBefore + 60);
    expect(Object.values(first.stateStore.getState().splitSizesPx)).toContain(sizeAfter);
    first.inspector.dispose();
    const second = shellInspectorTestCreate(storage);
    expect(shellInspectorTestPaneSizeRead(second.inspector.slotRead('map_layers'))).toBe(sizeAfter);
  });

  it('throws for slots after dispose and removes its element', () => {
    const { inspector } = shellInspectorTestCreate(shellTestStorageCreate());
    inspector.dispose();
    expect(inspector.getElement().isConnected).toBe(false);
    expect(() => inspector.slotRead('face')).toThrow();
  });
});
