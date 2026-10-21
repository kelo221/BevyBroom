import type { ShellFrame } from '@/layout/shell/frame/shell_frame.js';
import type { ShellInspector, ShellInspectorTabId } from '@/layout/shell/inspector/shell_inspector.js';
import type { ShellInfoPanel, ShellInfoPanelTabId } from '@/layout/shell/info_panel/shell_info_panel.js';
import type { Toolbar } from '@/ui/toolbar/toolbar.js';

/** Inspector tabs in display order. */
export const SHELL_MAIN_WINDOW_INSPECTOR_TABS: readonly ShellInspectorTabId[] = ['map', 'entity', 'face'];

/** Info panel tabs in display order. */
export const SHELL_MAIN_WINDOW_INFO_PANEL_TABS: readonly ShellInfoPanelTabId[] = ['console', 'issues'];

/** Arrangement of the main window docks and bars. */
export interface ShellMainWindowState {
  /** True while the inspector is shown. */
  inspectorVisible: boolean;
  /** Shown inspector tab. */
  inspectorTab: ShellInspectorTabId;
  /** True while the info panel is shown. */
  infoPanelVisible: boolean;
  /** Shown info panel tab. */
  infoPanelTab: ShellInfoPanelTabId;
  /** True while the icon toolbar is shown. */
  toolbarVisible: boolean;
  /** Menu bar titles in display order. */
  menus: string[];
}

/** Changes to the main window arrangement; omitted fields stay as they are. */
export type ShellMainWindowChanges = Partial<Omit<ShellMainWindowState, 'menus'>>;

/** Main window parts the control reads and changes. */
export interface ShellMainWindowParts {
  frame: ShellFrame;
  inspector: ShellInspector;
  infoPanel: ShellInfoPanel;
  menuBar: Toolbar;
}

/** Reads and changes which docks, tabs and bars of the main window are shown. */
export class ShellMainWindowControl {
  /**
   * Creates the control over the main window parts.
   *
   * @param parts Frame, docks and menu bar.
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
      inspectorTab: this.inspectorTabRead(),
      infoPanelVisible: this.parts.frame.isInfoPanelVisible(),
      infoPanelTab: this.infoPanelTabRead(),
      toolbarVisible: this.parts.frame.isToolbarVisible(),
      menus: this.menuTitlesRead(),
    };
  }

  /**
   * Applies arrangement changes and returns the new arrangement.
   *
   * @param changes Fields to change.
   * @returns Main window state after the changes.
   */
  changesApply(changes: ShellMainWindowChanges): ShellMainWindowState {
    if (changes.inspectorTab !== undefined) this.parts.inspector.tabShow(changes.inspectorTab);
    if (changes.infoPanelTab !== undefined) this.parts.infoPanel.tabShow(changes.infoPanelTab);
    if (changes.inspectorVisible !== undefined) this.parts.frame.inspectorVisibleSet(changes.inspectorVisible);
    if (changes.infoPanelVisible !== undefined) this.parts.frame.infoPanelVisibleSet(changes.infoPanelVisible);
    if (changes.toolbarVisible !== undefined) this.parts.frame.toolbarVisibleSet(changes.toolbarVisible);
    return this.stateRead();
  }

  /**
   * Returns the shown inspector tab.
   *
   * @returns Inspector tab id.
   */
  private inspectorTabRead(): ShellInspectorTabId {
    const tabId = this.parts.inspector.activeTabIdRead();
    return SHELL_MAIN_WINDOW_INSPECTOR_TABS.find((candidate) => candidate === tabId) ?? 'map';
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
}
