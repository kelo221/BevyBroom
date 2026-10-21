import { SplitterBox } from '@/ui/splitter/splitter_box.js';
import { ShellDockTabbed, type ShellDockTabDefinition } from '@/layout/shell/dock/shell_dock_tabbed.js';
import type { ShellStateStore } from '@/layout/shell/state/shell_state_store.js';

/** Ids of the inspector tabs. */
export type ShellInspectorTabId = 'map' | 'entity' | 'face';

/** Places inside the inspector that editor panels are mounted into. */
export type ShellInspectorSlot = 'map_layers' | 'map_outliner' | 'entity_properties' | 'entity_browser' | 'face';

/** Inspector tabs in display order. */
export const SHELL_INSPECTOR_TABS: readonly ShellDockTabDefinition[] = [
  { id: 'map', label: 'Map' },
  { id: 'entity', label: 'Entity' },
  { id: 'face', label: 'Face' },
];

/** Splitter key and starting size of the layers list above the outliner. */
const SHELL_INSPECTOR_MAP_SPLIT = { key: 'inspector_map_layers', initialPx: 170, minPx: 80 } as const;

/** Splitter key and starting size of the properties above the entity browser. */
const SHELL_INSPECTOR_ENTITY_SPLIT = { key: 'inspector_entity_properties', initialPx: 320, minPx: 120 } as const;

/** Splitter description used to build one inner split of an inspector page. */
interface ShellInspectorSplitDefinition {
  readonly key: string;
  readonly initialPx: number;
  readonly minPx: number;
}

/**
 * Right-hand inspector with Map, Entity and Face tabs. The Map tab stacks the
 * layers list over the outliner, the Entity tab stacks the properties over the
 * entity browser, and the Face tab holds the face inspector.
 */
export class ShellInspector extends ShellDockTabbed {
  private readonly slots: Map<ShellInspectorSlot, HTMLElement>;
  private readonly splitters: SplitterBox[];

  /**
   * Creates the inspector and restores its tab and inner splitter sizes.
   *
   * @param stateStore Store that keeps the shown tab and splitter sizes.
   */
  constructor(stateStore: ShellStateStore) {
    super('Inspector', SHELL_INSPECTOR_TABS, stateStore.getState().inspectorTabId);
    this.slots = new Map();
    this.splitters = [];
    this.splitPageBuild('map', ['map_layers', 'map_outliner'], SHELL_INSPECTOR_MAP_SPLIT, stateStore);
    this.splitPageBuild('entity', ['entity_properties', 'entity_browser'], SHELL_INSPECTOR_ENTITY_SPLIT, stateStore);
    this.facePageBuild();
    this.tabChangeListenerAdd((tabId) => stateStore.update({ inspectorTabId: tabId }));
    this.getElement().classList.add('shell-inspector');
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

  /** Removes the inspector, its splitters and its pages. */
  override dispose(): void {
    this.splitters.forEach((splitter) => splitter.dispose());
    this.splitters.length = 0;
    this.slots.clear();
    super.dispose();
  }

  /**
   * Fills one tab page with a vertical splitter whose upper pane keeps its
   * size.
   *
   * @param tabId Tab whose page receives the splitter.
   * @param slotNames Slots of the upper and the lower pane.
   * @param split Splitter key, starting size and minimum size.
   * @param stateStore Store that keeps the splitter size.
   */
  private splitPageBuild(
    tabId: ShellInspectorTabId,
    slotNames: readonly [ShellInspectorSlot, ShellInspectorSlot],
    split: ShellInspectorSplitDefinition,
    stateStore: ShellStateStore,
  ): void {
    const splitter = new SplitterBox({
      orientation: 'vertical',
      sizedPane: 'first',
      initialSizePx: stateStore.splitSizeRead(split.key, split.initialPx),
      minSizedPx: split.minPx,
      minFlexiblePx: 80,
    });
    splitter.changeListenerAdd((sizePx) => stateStore.splitSizeWrite(split.key, sizePx));
    this.pageRead(tabId)?.appendChild(splitter.getElement());
    this.slots.set(slotNames[0], splitter.getFirstPane());
    this.slots.set(slotNames[1], splitter.getSecondPane());
    this.splitters.push(splitter);
  }

  /** Uses the whole Face page as the face slot. */
  private facePageBuild(): void {
    const page = this.pageRead('face');
    if (page) {
      this.slots.set('face', page);
    }
  }
}
