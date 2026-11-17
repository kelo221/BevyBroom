import { MenuContext, type MenuContextItem } from '@/ui/menu/menu_context.js';
import { DOCK_SIDE_LABELS, DOCK_SIDES, type DockSide } from '@/ui/dock/dock_side.js';

/** Label of the menu row that floats a docked window. */
export const DOCK_WINDOW_MENU_FLOAT_LABEL = 'Float';

/** Label of the menu row that closes a window. */
export const DOCK_WINDOW_MENU_CLOSE_LABEL = 'Close';

/** What the layout menu of a window runs. */
export interface DockWindowMenuActions {
  /**
   * Docks a window to an edge, or floats it with null.
   *
   * @param windowId Window layout id.
   * @param side Dock edge, or null.
   */
  windowDock(windowId: string, side: DockSide | null): void;
  /**
   * Closes a window.
   *
   * @param windowId Window layout id.
   */
  windowClose(windowId: string): void;
}

/**
 * Right-click menu of a tool window's title bar or dock tab: dock to each edge,
 * float, close. The current placement's row is disabled.
 */
export class DockWindowMenu {
  private readonly actions: DockWindowMenuActions;
  private menu: MenuContext | null = null;

  /**
   * Creates the menu.
   *
   * @param actions What the rows run.
   */
  constructor(actions: DockWindowMenuActions) {
    this.actions = actions;
  }

  /**
   * Opens the menu of one window at a point.
   *
   * @param windowId Window layout id.
   * @param currentSide Edge the window is docked to, or null while floating.
   * @param clientX Menu client X.
   * @param clientY Menu client Y.
   */
  open(windowId: string, currentSide: DockSide | null, clientX: number, clientY: number): void {
    this.dispose();
    this.menu = new MenuContext(document.body, this.itemsBuild(windowId, currentSide));
    this.menu.show(clientX, clientY);
  }

  /** Closes and drops the open menu. */
  dispose(): void {
    this.menu?.dispose();
    this.menu = null;
  }

  /**
   * Builds the rows for one window.
   *
   * @param windowId Window layout id.
   * @param currentSide Current dock edge, or null.
   * @returns Menu rows.
   */
  private itemsBuild(windowId: string, currentSide: DockSide | null): MenuContextItem[] {
    const dockItems: MenuContextItem[] = DOCK_SIDES.map((side) => ({
      label: DOCK_SIDE_LABELS[side],
      callback: () => this.actions.windowDock(windowId, side),
      disabled: currentSide === side,
    }));
    return [
      ...dockItems,
      {
        label: DOCK_WINDOW_MENU_FLOAT_LABEL,
        callback: () => this.actions.windowDock(windowId, null),
        disabled: currentSide === null,
      },
      { kind: 'separator' },
      { label: DOCK_WINDOW_MENU_CLOSE_LABEL, callback: () => this.actions.windowClose(windowId) },
    ];
  }
}
