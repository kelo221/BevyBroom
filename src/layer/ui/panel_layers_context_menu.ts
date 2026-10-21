import { LAYER_DEFAULT_ID } from '@/layer/model/layer_definition.js';
import { MenuContext, type MenuContextItem } from '@/ui/menu/menu_context.js';

/** Actions the context menu of a layer row offers. */
export interface PanelLayersContextMenuActions {
  /** Makes the layer current. */
  makeCurrent: (layerIdentifier: string) => void;
  /** Moves the selected objects into the layer. */
  selectionMoveHere: (layerIdentifier: string) => void;
  /** Selects every object of the layer. */
  selectAll: (layerIdentifier: string) => void;
  /** Shows only the layer. */
  isolate: (layerIdentifier: string) => void;
  /** Shows every layer. */
  showAll: () => void;
  /** Starts renaming the layer. */
  rename: (layerIdentifier: string) => void;
  /** Removes the layer. */
  remove: (layerIdentifier: string) => void;
  /** Returns whether anything is selected. */
  selectionAnyIs: () => boolean;
  /** Returns whether the layer's objects can be selected. */
  layerSelectableIs: (layerIdentifier: string) => boolean;
}

/** Context menu of a layer row, built on the shared context menu. */
export class PanelLayersContextMenu {
  private readonly actions: PanelLayersContextMenuActions;
  private menu: MenuContext | null;

  /**
   * Creates the context menu.
   *
   * @param actions Actions the menu offers.
   */
  constructor(actions: PanelLayersContextMenuActions) {
    this.actions = actions;
    this.menu = null;
  }

  /**
   * Opens the menu of one layer at a client position, closing any open menu.
   *
   * @param host Element the menu belongs to.
   * @param layerIdentifier Layer the menu acts on.
   * @param clientX Horizontal client position.
   * @param clientY Vertical client position.
   */
  open(host: HTMLElement, layerIdentifier: string, clientX: number, clientY: number): void {
    this.dispose();
    this.menu = new MenuContext(host, this.itemsBuild(layerIdentifier));
    this.menu.show(clientX, clientY);
  }

  /**
   * Returns the open menu element.
   *
   * @returns Menu element, or null when no menu is open.
   */
  elementRead(): HTMLElement | null {
    return this.menu?.getElement() ?? null;
  }

  /** Closes and releases the open menu. */
  dispose(): void {
    this.menu?.dispose();
    this.menu = null;
  }

  /**
   * Builds the menu items of one layer.
   *
   * @param layerIdentifier Layer the menu acts on.
   * @returns Menu items.
   */
  private itemsBuild(layerIdentifier: string): MenuContextItem[] {
    return [
      ...this.itemsSelectionBuild(layerIdentifier),
      { kind: 'separator' },
      { label: 'Isolate', callback: () => this.actions.isolate(layerIdentifier) },
      { label: 'Show All', callback: () => this.actions.showAll() },
      { kind: 'separator' },
      ...this.itemsEditBuild(layerIdentifier),
    ];
  }

  /**
   * Builds the items that make the layer current or work with the selection.
   *
   * @param layerIdentifier Layer the menu acts on.
   * @returns Menu items.
   */
  private itemsSelectionBuild(layerIdentifier: string): MenuContextItem[] {
    const actions = this.actions;
    return [
      { label: 'Make Current', callback: () => actions.makeCurrent(layerIdentifier) },
      {
        label: 'Move Selection Here',
        callback: () => actions.selectionMoveHere(layerIdentifier),
        disabled: !actions.selectionAnyIs(),
      },
      {
        label: 'Select All in Layer',
        callback: () => actions.selectAll(layerIdentifier),
        disabled: !actions.layerSelectableIs(layerIdentifier),
      },
    ];
  }

  /**
   * Builds the rename and remove items, disabled for the default layer.
   *
   * @param layerIdentifier Layer the menu acts on.
   * @returns Menu items.
   */
  private itemsEditBuild(layerIdentifier: string): MenuContextItem[] {
    const isDefault = layerIdentifier === LAYER_DEFAULT_ID;
    return [
      { label: 'Rename', callback: () => this.actions.rename(layerIdentifier), disabled: isDefault },
      { label: 'Remove', callback: () => this.actions.remove(layerIdentifier), disabled: isDefault },
    ];
  }
}
