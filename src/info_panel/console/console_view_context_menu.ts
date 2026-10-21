import { MenuContext, type MenuContextItem } from '@/ui/menu/menu_context.js';

/** Opens the console's right-click menu, offering Clear, over a host element. */
export class ConsoleViewContextMenu {
  private readonly hostElement: HTMLElement;
  private readonly onClear: () => void;
  private readonly contextMenuListener: (event: MouseEvent) => void;
  private menu: MenuContext | null = null;

  /**
   * Starts listening for right clicks on the host.
   *
   * @param hostElement Element whose right click opens the menu.
   * @param onClear Runs when Clear is chosen.
   */
  constructor(hostElement: HTMLElement, onClear: () => void) {
    this.hostElement = hostElement;
    this.onClear = onClear;
    this.contextMenuListener = (event) => this.contextMenuOpen(event);
    this.hostElement.addEventListener('contextmenu', this.contextMenuListener);
  }

  /** Stops listening and closes the menu. */
  dispose(): void {
    this.hostElement.removeEventListener('contextmenu', this.contextMenuListener);
    this.menuDispose();
  }

  /**
   * Opens a fresh menu at the pointer.
   *
   * @param event Right-click event.
   */
  private contextMenuOpen(event: MouseEvent): void {
    event.preventDefault();
    this.menuDispose();
    this.menu = new MenuContext(this.hostElement, this.menuItemsBuild());
    this.menu.show(event.clientX, event.clientY);
  }

  /**
   * Builds the menu rows.
   *
   * @returns Menu rows.
   */
  private menuItemsBuild(): MenuContextItem[] {
    return [{ label: 'Clear', callback: () => this.onClear() }];
  }

  /** Closes and releases the open menu. */
  private menuDispose(): void {
    this.menu?.dispose();
    this.menu = null;
  }
}
