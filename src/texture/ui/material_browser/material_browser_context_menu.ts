import { MenuContext, type MenuContextItem } from '@/ui/menu/menu_context.js';
import type { TextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';

/** Actions the material browser context menu runs. */
export interface MaterialBrowserContextMenuHandlers {
  onSelectFacesUsingMaterial: (entry: TextureBrowserEntry) => void;
  onSelectObjectsUsingMaterial: (entry: TextureBrowserEntry) => void;
  onCopyName: (entry: TextureBrowserEntry) => void;
}

/**
 * Right-click menu of one material tile: select the faces or objects using the
 * material, or copy its name. The browser opens it for the tile that received
 * the right click.
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
      { label: 'Copy Name', callback: () => this.handlers.onCopyName(entry) },
    ];
  }

  /** Closes and releases the open menu. */
  private menuDispose(): void {
    this.menu?.dispose();
    this.menu = null;
  }
}
