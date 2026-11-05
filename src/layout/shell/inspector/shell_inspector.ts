import { Theme } from '@/theme.js';
import { SplitterBox } from '@/ui/splitter/splitter_box.js';
import { ShellDock } from '@/layout/shell/dock/shell_dock.js';
import type { ShellStateStore } from '@/layout/shell/state/shell_state_store.js';

/** Places inside the inspector that editor panels are mounted into. */
export type ShellInspectorSlot =
  'hammer_object_bar' | 'hammer_visgroups' | 'hammer_prefabs' | 'map_layers' | 'map_outliner';

/** Slots of the pinned Hammer bar from top to bottom. */
export const SHELL_INSPECTOR_HAMMER_BAR_SLOTS: readonly ShellInspectorSlot[] = [
  'hammer_object_bar',
  'hammer_visgroups',
  'hammer_prefabs',
];

/** Splitter key and starting size of the layers list above the outliner. */
const SHELL_INSPECTOR_MAP_SPLIT = { key: 'inspector_map_layers', initialPx: 170, minPx: 80 } as const;

/**
 * Right-hand inspector laid out like the Hammer++ right bar: a pinned,
 * scrollable Hammer bar on top and the Map section (layers over the outliner)
 * filling the rest.
 */
export class ShellInspector extends ShellDock {
  private readonly slots: Map<ShellInspectorSlot, HTMLElement>;
  private readonly mapSplitter: SplitterBox;

  /**
   * Creates the inspector and restores the Map section splitter size.
   *
   * @param stateStore Store that keeps the splitter size.
   */
  constructor(stateStore: ShellStateStore) {
    super(document.createElement('div'));
    this.slots = new Map();
    this.inspectorRootStyle();
    this.getElement().appendChild(this.hammerBarCreate());
    this.mapSplitter = this.mapSectionCreate(stateStore);
    this.getElement().appendChild(this.mapSplitter.getElement());
  }

  /**
   * Returns the element a panel is mounted into.
   *
   * @param slot Inspector slot.
   * @returns Slot element.
   */
  slotRead(slot: ShellInspectorSlot): HTMLElement {
    const element = this.slots.get(slot);
    if (!element) {
      throw new Error(`Unknown inspector slot ${slot}`);
    }
    return element;
  }

  /** Removes the inspector, its splitter and its slots. */
  override dispose(): void {
    this.mapSplitter.dispose();
    this.slots.clear();
    super.dispose();
  }

  /**
   * Lays the inspector root out as a column that fills the dock pane and gives
   * every panel inside it the UI font unless a panel picks its own.
   */
  private inspectorRootStyle(): void {
    const root = this.getElement();
    root.classList.add('shell-inspector');
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.height = '100%';
    root.style.overflow = 'hidden';
    root.style.fontFamily = Theme.uiFontFamily;
    root.style.color = Theme.buttonTextColor;
  }

  /**
   * Creates the pinned Hammer bar holding one slot per Hammer bar section.
   *
   * @returns Hammer bar element.
   */
  private hammerBarCreate(): HTMLElement {
    const bar = document.createElement('div');
    bar.classList.add('shell-inspector-hammer-bar');
    bar.style.display = 'flex';
    bar.style.flexDirection = 'column';
    bar.style.flex = '0 1 auto';
    bar.style.minHeight = '0';
    bar.style.maxHeight = '60%';
    bar.style.overflowY = 'auto';
    SHELL_INSPECTOR_HAMMER_BAR_SLOTS.forEach((slot) => bar.appendChild(this.hammerBarSlotCreate(slot)));
    return bar;
  }

  /**
   * Creates and registers one Hammer bar section slot.
   *
   * @param slot Slot name.
   * @returns Slot element.
   */
  private hammerBarSlotCreate(slot: ShellInspectorSlot): HTMLElement {
    const element = document.createElement('div');
    element.classList.add('shell-inspector-slot', `shell-inspector-slot-${slot}`);
    element.dataset['inspectorSlot'] = slot;
    element.style.display = 'flex';
    element.style.flexDirection = 'column';
    element.style.flex = '0 0 auto';
    this.slots.set(slot, element);
    return element;
  }

  /**
   * Creates the Map section: a vertical splitter whose upper layers pane keeps
   * its size over the outliner.
   *
   * @param stateStore Store that keeps the splitter size.
   * @returns Map section splitter.
   */
  private mapSectionCreate(stateStore: ShellStateStore): SplitterBox {
    const splitter = new SplitterBox({
      orientation: 'vertical',
      sizedPane: 'first',
      initialSizePx: stateStore.splitSizeRead(SHELL_INSPECTOR_MAP_SPLIT.key, SHELL_INSPECTOR_MAP_SPLIT.initialPx),
      minSizedPx: SHELL_INSPECTOR_MAP_SPLIT.minPx,
      minFlexiblePx: 80,
    });
    splitter.changeListenerAdd((sizePx) => stateStore.splitSizeWrite(SHELL_INSPECTOR_MAP_SPLIT.key, sizePx));
    splitter.getElement().classList.add('shell-inspector-map-section');
    splitter.getElement().style.flex = '1 1 auto';
    splitter.getElement().style.minHeight = '0';
    this.slots.set('map_layers', splitter.getFirstPane());
    this.slots.set('map_outliner', splitter.getSecondPane());
    return splitter;
  }
}
