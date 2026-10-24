import { MenuContext, type MenuContextItem } from '@/ui/menu/menu_context.js';
import type { TextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';

/** Right-click actions offered for one material tile. */
export interface MaterialBrowserContextMenuHandlers {
  /** Selects the faces painted with the material. */
  onSelectFacesUsingMaterial: (entry: TextureBrowserEntry) => void;
  /** Selects the brushes and objects painted with the material. */
  onSelectObjectsUsingMaterial: (entry: TextureBrowserEntry) => void;
  /** Repaints the faces using the material with the selected material. */
  onReplaceWithSelectedMaterial: (entry: TextureBrowserEntry) => void;
  /** Returns the id of the material selected in the browser, or ''. */
  selectedMaterialIdRead: () => string;
  /** Copies the material name. */
  onCopyName: (entry: TextureBrowserEntry) => void;
}

/**
 * Right-click menu of one material tile: select the faces or objects using the
 * material, replace it with the selected material, or copy its name. The
 * browser opens it for the tile that received the right click.
 */
export class MaterialBrowserContextMenu {
  private readonly hostElement: HTMLElement;
  private readonly handlers: MaterialBrowserContextMenuHandlers;
  private menu: MenuContext | null;

  /**
   * Creates the context menu bound to the browser grid.
   *
   * @param hostElement Element the menu is positioned against.
   * @param handlers Menu actions.
   */
  constructor(hostElement: HTMLElement, handlers: MaterialBrowserContextMenuHandlers) {
    this.hostElement = hostElement;
    this.handlers = handlers;
    this.menu = null;
  }

  /**
   * Opens the menu of one tile at the pointer.
   *
   * @param entry Material entry the menu acts on.
   * @param clientX Pointer viewport X.
   * @param clientY Pointer viewport Y.
   */
  openForEntry(entry: TextureBrowserEntry, clientX: number, clientY: number): void {
    this.menuDispose();
    this.menu = new MenuContext(this.hostElement, this.menuItemsBuild(entry));
    this.menu.show(clientX, clientY);
  }

  /** Closes and releases the open menu. */
  dispose(): void {
    this.menuDispose();
  }

  /**
   * Builds the menu rows for one material.
   *
   * @param entry Material entry.
   * @returns Menu rows.
   */
  private menuItemsBuild(entry: TextureBrowserEntry): MenuContextItem[] {
    return [
      {
        label: 'Select Faces Using This Material',
        callback: () => this.handlers.onSelectFacesUsingMaterial(entry),
      },
      {
        label: 'Select Brushes/Objects Using This Material',
        callback: () => this.handlers.onSelectObjectsUsingMaterial(entry),
      },
      { kind: 'separator' },
      {
        label: 'Replace With Selected Material',
        callback: () => this.handlers.onReplaceWithSelectedMaterial(entry),
        disabled: !this.replacementAvailableIs(entry),
      },
      { kind: 'separator' },
      { label: 'Copy Name', callback: () => this.handlers.onCopyName(entry) },
    ];
  }

  /**
   * Returns whether another material is selected to replace this one with.
   *
   * @param entry Right-clicked material entry.
   * @returns True when a different material is selected.
   */
  private replacementAvailableIs(entry: TextureBrowserEntry): boolean {
    const selectedMaterialId = this.handlers.selectedMaterialIdRead();
    return selectedMaterialId !== '' && selectedMaterialId !== entry.id;
  }

  /** Closes and releases the open menu. */
  private menuDispose(): void {
    this.menu?.dispose();
    this.menu = null;
  }
}
