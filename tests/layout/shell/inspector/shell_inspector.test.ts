import { afterEach, describe, expect, it } from 'vitest';
import {
  SHELL_INSPECTOR_HAMMER_BAR_SLOTS,
  ShellInspector,
  type ShellInspectorSlot,
} from '@/layout/shell/inspector/shell_inspector.js';
import { ShellStateStore } from '@/layout/shell/state/shell_state_store.js';
import { shellTestStorageCreate } from '../shell_test_support.js';

/** Every inspector slot in top to bottom order. */
const SHELL_INSPECTOR_TEST_SLOTS: readonly ShellInspectorSlot[] = [
  'hammer_object_bar',
  'hammer_visgroups',
  'hammer_prefabs',
  'map_layers',
  'map_outliner',
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

/**
 * Returns whether one element comes before another in document order.
 *
 * @param earlier Element expected first.
 * @param later Element expected second.
 * @returns True when earlier precedes later.
 */
function shellInspectorTestPrecedes(earlier: HTMLElement, later: HTMLElement): boolean {
  return (earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('ShellInspector', () => {
  it('has no tabs and no Entity or Face page', () => {
    const { inspector } = shellInspectorTestCreate(shellTestStorageCreate());
    const root = inspector.getElement();
    expect(root.classList.contains('shell-inspector')).toBe(true);
    expect(root.querySelectorAll('[role="tab"]').length).toBe(0);
    expect(root.querySelector('.shell-dock-page-entity')).toBeNull();
    expect(root.querySelector('.shell-dock-page-face')).toBeNull();
  });

  it('returns a distinct connected element for every slot in top to bottom order', () => {
    const { inspector } = shellInspectorTestCreate(shellTestStorageCreate());
    const slotElements = SHELL_INSPECTOR_TEST_SLOTS.map((slot) => inspector.slotRead(slot));
    expect(new Set(slotElements).size).toBe(SHELL_INSPECTOR_TEST_SLOTS.length);
    slotElements.forEach((element) => expect(element.isConnected).toBe(true));
    slotElements.slice(1).forEach((element, index) => {
      const previous = slotElements[index];
      expect(previous && shellInspectorTestPrecedes(previous, element)).toBe(true);
    });
  });

  it('keeps the Hammer bar slots together in one scrollable bar above the Map section', () => {
    const { inspector } = shellInspectorTestCreate(shellTestStorageCreate());
    const bar = inspector.getElement().querySelector<HTMLElement>('.shell-inspector-hammer-bar');
    expect(bar).not.toBeNull();
    expect(bar?.style.overflowY).toBe('auto');
    SHELL_INSPECTOR_HAMMER_BAR_SLOTS.forEach((slot) => expect(bar?.contains(inspector.slotRead(slot))).toBe(true));
    expect(bar?.contains(inspector.slotRead('map_layers'))).toBe(false);
  });

  it('keeps the layers and the outliner in separate panes of the Map section splitter', () => {
    const { inspector } = shellInspectorTestCreate(shellTestStorageCreate());
    const layers = inspector.slotRead('map_layers');
    const outliner = inspector.slotRead('map_outliner');
    expect(layers.parentElement).toBe(outliner.parentElement);
    expect(layers.parentElement?.classList.contains('splitter-box')).toBe(true);
    expect(layers.parentElement?.classList.contains('shell-inspector-map-section')).toBe(true);
  });

  it('remembers a dragged Map section splitter size and restores it in a fresh inspector', () => {
    const storage = shellTestStorageCreate();
    const first = shellInspectorTestCreate(storage);
    const layersPane = first.inspector.slotRead('map_layers');
    const sizeBefore = shellInspectorTestPaneSizeRead(layersPane);
    shellInspectorTestDividerDragAfter(layersPane, 60);
    const sizeAfter = shellInspectorTestPaneSizeRead(layersPane);
    expect(sizeAfter).toBe(sizeBefore + 60);
    expect(first.stateStore.getState().splitSizesPx['inspector_map_layers']).toBe(sizeAfter);
    first.inspector.dispose();
    const second = shellInspectorTestCreate(storage);
    expect(shellInspectorTestPaneSizeRead(second.inspector.slotRead('map_layers'))).toBe(sizeAfter);
  });

  it('throws for slots after dispose and removes its element', () => {
    const { inspector } = shellInspectorTestCreate(shellTestStorageCreate());
    inspector.dispose();
    expect(inspector.getElement().isConnected).toBe(false);
    expect(() => inspector.slotRead('map_layers')).toThrow();
  });
});
