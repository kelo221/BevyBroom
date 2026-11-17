import { Theme } from '@/theme.js';
import { TabBook } from '@/ui/tabs/tab_book.js';
import { styleFloatingPanelChromeButton } from '@/ui/floating_panel/panel_floating_title_bar.js';
import type { DockSide } from '@/ui/dock/dock_side.js';
import { DockZoneTabDrag } from './dock_zone_tab_drag.js';

/** Data attribute naming the edge of a dock zone element. */
export const DOCK_ZONE_SIDE_ATTRIBUTE = 'data-dock-zone-side';

/** Data attribute naming the window of a dock zone page. */
export const DOCK_ZONE_WINDOW_ATTRIBUTE = 'data-dock-zone-window';

/** What a dock zone asks of the dock system. */
export interface DockZoneHost {
  /**
   * Floats a docked window, continuing a drag when one pulled it out.
   *
   * @param windowId Window layout id.
   * @param dragEvent Pointer event of the drag that pulled the tab out, or
   *   null.
   */
  windowFloat(windowId: string, dragEvent: PointerEvent | null): void;
  /**
   * Closes a docked window.
   *
   * @param windowId Window layout id.
   */
  windowClose(windowId: string): void;
  /**
   * Opens the layout menu of a docked window.
   *
   * @param windowId Window layout id.
   * @param clientX Menu client X.
   * @param clientY Menu client Y.
   */
  windowMenuOpen(windowId: string, clientX: number, clientY: number): void;
}

/**
 * One dock along an edge of the main window: a tab per docked window, the shown
 * window below the tabs, and Float and Close buttons for the shown window. A
 * tab dragged off the strip floats its window.
 */
export class DockZone {
  private readonly side: DockSide;
  private readonly host: DockZoneHost;
  private readonly tabBook: TabBook;
  private readonly pages = new Map<string, HTMLElement>();
  private readonly tabDrag: DockZoneTabDrag;

  /**
   * Creates an empty dock zone.
   *
   * @param ownerDocument Document that creates the elements.
   * @param side Edge of the main window the zone docks to.
   * @param host Dock system callbacks.
   */
  constructor(ownerDocument: Document, side: DockSide, host: DockZoneHost) {
    this.side = side;
    this.host = host;
    this.tabBook = new TabBook({ ariaLabel: `${side} dock`, variant: 'compact', ownerDocument });
    this.tabDrag = new DockZoneTabDrag(this.tabBook.getStripElement(), (windowId, event) =>
      host.windowFloat(windowId, event),
    );
    this.rootStylesApply();
    this.tabBook.getStripElement().appendChild(this.stripButtonsCreate(ownerDocument));
  }

  /**
   * Returns the zone root.
   *
   * @returns Zone element.
   */
  getElement(): HTMLElement {
    return this.tabBook.getElement();
  }

  /**
   * Returns the edge the zone docks to.
   *
   * @returns Dock edge.
   */
  sideRead(): DockSide {
    return this.side;
  }

  /**
   * Adds a window as a tab and shows it.
   *
   * @param windowId Window layout id.
   * @param title Tab label.
   * @param windowRoot Root element of the window.
   */
  windowAdd(windowId: string, title: string, windowRoot: HTMLElement): void {
    const page = this.pageEnsure(windowId);
    page.replaceChildren(windowRoot);
    this.tabBook.tabAdd({ id: windowId, label: title, pageResolve: () => page });
    this.tabBook.tabLabelSet(windowId, title);
    this.tabButtonBind(windowId);
    this.tabBook.tabShow(windowId);
  }

  /**
   * Removes the tab of a window.
   *
   * @param windowId Window layout id.
   */
  windowRemove(windowId: string): void {
    this.tabBook.tabRemove(windowId);
    this.pages.delete(windowId);
  }

  /**
   * Shows the tab of a window.
   *
   * @param windowId Window layout id.
   * @returns True when the window is docked here.
   */
  windowShow(windowId: string): boolean {
    return this.tabBook.tabShow(windowId);
  }

  /**
   * Lists the docked windows in tab order.
   *
   * @returns Window layout ids.
   */
  windowIdsList(): string[] {
    return this.tabBook.tabIdsList();
  }

  /**
   * Returns the shown window.
   *
   * @returns Window layout id, or null when the zone is empty.
   */
  activeWindowIdRead(): string | null {
    return this.windowIdsList().length === 0 ? null : this.tabBook.getActiveTabId();
  }

  /**
   * Returns whether no window is docked here.
   *
   * @returns True when empty.
   */
  isEmpty(): boolean {
    return this.windowIdsList().length === 0;
  }

  /** Removes the zone from the document. */
  dispose(): void {
    this.tabBook.dispose();
    this.pages.clear();
  }

  /** Styles the zone root to fill its dock pane. */
  private rootStylesApply(): void {
    const root = this.tabBook.getElement();
    root.setAttribute(DOCK_ZONE_SIDE_ATTRIBUTE, this.side);
    root.style.width = '100%';
    root.style.height = '100%';
    root.style.overflow = 'hidden';
    root.style.background = Theme.windowBackground;
    this.tabBook.getStripElement().style.minHeight = `${Theme.viewportLabelHeightPx + 4}px`;
  }

  /**
   * Returns the page holding a window, creating it on first use.
   *
   * @param windowId Window layout id.
   * @returns Page element.
   */
  private pageEnsure(windowId: string): HTMLElement {
    const existing = this.pages.get(windowId);
    if (existing) {
      return existing;
    }
    const page = this.tabBook.getElement().ownerDocument.createElement('div');
    page.setAttribute(DOCK_ZONE_WINDOW_ATTRIBUTE, windowId);
    page.style.display = 'flex';
    page.style.flexDirection = 'column';
    page.style.flex = '1 1 auto';
    page.style.minHeight = '0';
    page.style.overflow = 'hidden';
    this.pages.set(windowId, page);
    return page;
  }

  /**
   * Makes a tab float its window when dragged off or double-clicked and open
   * the layout menu on right click.
   *
   * @param windowId Window layout id.
   */
  private tabButtonBind(windowId: string): void {
    const button = this.tabBook.tabButtonRead(windowId);
    if (button === null || button.dataset['dockZoneBound'] === 'true') {
      return;
    }
    button.dataset['dockZoneBound'] = 'true';
    button.title = 'Drag off to float; right-click for dock options';
    button.addEventListener('pointerdown', (event) => this.tabDrag.pressHandle(windowId, event));
    button.addEventListener('dblclick', () => this.host.windowFloat(windowId, null));
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      this.host.windowMenuOpen(windowId, event.clientX, event.clientY);
    });
  }

  /**
   * Creates the Float and Close buttons at the end of the tab strip.
   *
   * @param ownerDocument Document that creates the elements.
   * @returns Button group.
   */
  private stripButtonsCreate(ownerDocument: Document): HTMLElement {
    const group = ownerDocument.createElement('div');
    group.style.display = 'flex';
    group.style.gap = '2px';
    group.style.marginLeft = 'auto';
    group.style.padding = '2px 0';
    group.append(
      this.stripButtonCreate(ownerDocument, '⧉', 'Float', (windowId) => this.host.windowFloat(windowId, null)),
      this.stripButtonCreate(ownerDocument, '×', 'Close', (windowId) => this.host.windowClose(windowId)),
    );
    return group;
  }

  /**
   * Creates one strip button acting on the shown window.
   *
   * @param ownerDocument Document that creates the element.
   * @param text Button text.
   * @param title Button tooltip and accessible name.
   * @param action Runs with the shown window.
   * @returns Button.
   */
  private stripButtonCreate(
    ownerDocument: Document,
    text: string,
    title: string,
    action: (windowId: string) => void,
  ): HTMLButtonElement {
    const button = ownerDocument.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.title = title;
    button.setAttribute('aria-label', title);
    styleFloatingPanelChromeButton(button);
    button.addEventListener('click', () => {
      const windowId = this.activeWindowIdRead();
      if (windowId !== null) {
        action(windowId);
      }
    });
    return button;
  }
}
