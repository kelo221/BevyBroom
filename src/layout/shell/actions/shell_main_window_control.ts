import type { ShellFrame } from '@/layout/shell/frame/shell_frame.js';
import {
  SHELL_INFO_PANEL_TAB_IDS,
  type ShellInfoPanel,
  type ShellInfoPanelTabId,
} from '@/layout/shell/info_panel/shell_info_panel.js';
import type { Toolbar } from '@/ui/toolbar/toolbar.js';
import type { ThemeLook } from '@/theme/theme_look.js';
import { THEME_LOOK_CURRENT } from '@/theme/theme_look_current.js';
import type { ShellDockCommands } from './shell_dock_commands.js';
import { SHELL_FLOATING_WINDOW_IDS, type ShellFloatingWindowId } from './shell_floating_window.js';
import { shellMainWindowLayoutRead, type ShellMainWindowLayout } from './shell_main_window_layout.js';

/** Info panel tabs in display order. */
export const SHELL_MAIN_WINDOW_INFO_PANEL_TABS: readonly ShellInfoPanelTabId[] = SHELL_INFO_PANEL_TAB_IDS;

/** Arrangement of the main window docks and bars. */
export interface ShellMainWindowState {
  /** True while the inspector is shown. */
  inspectorVisible: boolean;
  /** True while the info panel is shown. */
  infoPanelVisible: boolean;
  /** True while the info panel is folded to its one-line strip. */
  infoPanelCollapsed: boolean;
  /** Shown info panel tab. */
  infoPanelTab: ShellInfoPanelTabId;
  /** True while the icon toolbar is shown. */
  toolbarVisible: boolean;
  /** Menu bar titles in display order. */
  menus: string[];
  /**
   * True while the menus sit in the window; false once they moved into the
   * native menu bar.
   */
  menuBarInWindow: boolean;
  /** Chrome look the window started with. */
  themeLook: ThemeLook;
  /** True while each registered floating window is shown. */
  floatingWindows: Record<ShellFloatingWindowId, boolean>;
}

/** Changes to the main window arrangement; omitted fields stay as they are. */
export type ShellMainWindowChanges = Partial<
  Omit<ShellMainWindowState, 'menus' | 'menuBarInWindow' | 'themeLook' | 'floatingWindows'>
> & {
  floatingWindows?: Partial<Record<ShellFloatingWindowId, boolean>>;
};

/** Main window parts the control reads and changes. */
export interface ShellMainWindowParts {
  frame: ShellFrame;
  infoPanel: ShellInfoPanel;
  menuBar: Toolbar;
  dockCommands?: ShellDockCommands;
}

/** Reads and changes which docks, tabs and bars of the main window are shown. */
export class ShellMainWindowControl {
  /**
   * Creates the control over the main window parts.
   *
   * @param parts Frame, info panel and menu bar.
   */
  constructor(private readonly parts: ShellMainWindowParts) {}

  /**
   * Returns the current arrangement of the main window.
   *
   * @returns Main window state.
   */
  stateRead(): ShellMainWindowState {
    return {
      inspectorVisible: this.parts.frame.isInspectorVisible(),
      infoPanelVisible: this.parts.frame.isInfoPanelVisible(),
      infoPanelCollapsed: this.parts.frame.isInfoPanelCollapsed(),
      infoPanelTab: this.infoPanelTabRead(),
      toolbarVisible: this.parts.frame.isToolbarVisible(),
      menus: this.menuTitlesRead(),
      menuBarInWindow: this.parts.frame.isMenuBarVisible(),
      themeLook: THEME_LOOK_CURRENT,
      floatingWindows: this.floatingWindowsRead(),
    };
  }

  /**
   * Applies arrangement changes and returns the new arrangement.
   *
   * @param changes Fields to change.
   * @returns Main window state after the changes.
   */
  changesApply(changes: ShellMainWindowChanges): ShellMainWindowState {
    if (changes.infoPanelTab !== undefined) this.parts.infoPanel.tabShow(changes.infoPanelTab);
    if (changes.inspectorVisible !== undefined) this.parts.frame.inspectorVisibleSet(changes.inspectorVisible);
    if (changes.infoPanelVisible !== undefined) this.parts.frame.infoPanelVisibleSet(changes.infoPanelVisible);
    if (changes.infoPanelCollapsed !== undefined) this.parts.frame.infoPanelCollapsedSet(changes.infoPanelCollapsed);
    if (changes.toolbarVisible !== undefined) this.parts.frame.toolbarVisibleSet(changes.toolbarVisible);
    this.floatingWindowsApply(changes.floatingWindows);
    return this.stateRead();
  }

  /**
   * Returns where the map views, the info panel and the inspector sit on
   * screen.
   *
   * @returns Bounds of the main window areas.
   */
  layoutRead(): ShellMainWindowLayout {
    return shellMainWindowLayoutRead(this.parts.frame);
  }

  /**
   * Returns the shown info panel tab.
   *
   * @returns Info panel tab id.
   */
  private infoPanelTabRead(): ShellInfoPanelTabId {
    const tabId = this.parts.infoPanel.activeTabIdRead();
    return SHELL_MAIN_WINDOW_INFO_PANEL_TABS.find((candidate) => candidate === tabId) ?? 'console';
  }

  /**
   * Returns the menu bar titles in display order.
   *
   * @returns Menu titles.
   */
  private menuTitlesRead(): string[] {
    const headers = this.parts.menuBar.getElement().querySelectorAll<HTMLElement>('.editor-toolbar-menu-button');
    return Array.from(headers, (header) => header.textContent?.trim() ?? '');
  }

  /**
   * Returns whether each floating window is shown.
   *
   * @returns Open flag per floating window id.
   */
  private floatingWindowsRead(): Record<ShellFloatingWindowId, boolean> {
    const dockCommands = this.parts.dockCommands;
    const flags = {} as Record<ShellFloatingWindowId, boolean>;
    for (const windowId of SHELL_FLOATING_WINDOW_IDS) {
      flags[windowId] = dockCommands?.isFloatingWindowOpen(windowId) ?? false;
    }
    return flags;
  }

  /**
   * Shows or hides the floating windows named in the change.
   *
   * @param floatingWindows Wanted open flags; omitted ids stay as they are.
   */
  private floatingWindowsApply(floatingWindows: ShellMainWindowChanges['floatingWindows']): void {
    if (!floatingWindows) {
      return;
    }
    for (const windowId of SHELL_FLOATING_WINDOW_IDS) {
      const visible = floatingWindows[windowId];
      if (visible !== undefined) {
        this.parts.dockCommands?.floatingWindowVisibleSet(windowId, visible);
      }
    }
  }
}
