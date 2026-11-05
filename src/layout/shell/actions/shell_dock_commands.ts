import type { ShellFrame } from '@/layout/shell/frame/shell_frame.js';
import type { ShellInfoPanel, ShellInfoPanelTabId } from '@/layout/shell/info_panel/shell_info_panel.js';
import type { ShellFloatingWindow, ShellFloatingWindowId } from './shell_floating_window.js';

/**
 * Commands that show, hide and switch the main window docks and floating
 * windows.
 */
export class ShellDockCommands {
  private readonly frame: ShellFrame;
  private readonly infoPanel: ShellInfoPanel;
  private readonly floatingWindows: Map<ShellFloatingWindowId, ShellFloatingWindow>;

  /**
   * Creates dock commands over the main window docks.
   *
   * @param frame Main window skeleton that shows and hides the docks.
   * @param infoPanel Bottom info panel.
   */
  constructor(frame: ShellFrame, infoPanel: ShellInfoPanel) {
    this.frame = frame;
    this.infoPanel = infoPanel;
    this.floatingWindows = new Map();
  }

  /**
   * Registers the floating window opened and closed under one id.
   *
   * @param windowId Floating window id.
   * @param floatingWindow Window to open and close.
   */
  floatingWindowRegister(windowId: ShellFloatingWindowId, floatingWindow: ShellFloatingWindow): void {
    this.floatingWindows.set(windowId, floatingWindow);
  }

  /**
   * Shows a registered floating window when hidden and hides it when shown.
   *
   * @param windowId Floating window id.
   */
  floatingWindowToggle(windowId: ShellFloatingWindowId): void {
    this.floatingWindows.get(windowId)?.toggle();
  }

  /**
   * Returns whether a registered floating window is shown.
   *
   * @param windowId Floating window id.
   * @returns True while shown; false for an unregistered id.
   */
  isFloatingWindowOpen(windowId: ShellFloatingWindowId): boolean {
    return this.floatingWindows.get(windowId)?.isOpen() ?? false;
  }

  /** Shows the inspector when it is hidden. */
  inspectorReveal(): void {
    if (!this.frame.isInspectorVisible()) {
      this.frame.inspectorVisibleSet(true);
    }
  }

  /**
   * Shows the info panel with one tab in front.
   *
   * @param tabId Info panel tab to show.
   */
  infoPanelTabReveal(tabId: ShellInfoPanelTabId): void {
    if (!this.frame.isInfoPanelVisible()) {
      this.frame.infoPanelVisibleSet(true);
    }
    this.infoPanel.tabShow(tabId);
  }

  /** Shows the inspector when hidden and hides it when shown. */
  inspectorToggle(): void {
    this.frame.inspectorVisibleSet(!this.frame.isInspectorVisible());
  }

  /** Shows the info panel when hidden and hides it when shown. */
  infoPanelToggle(): void {
    this.frame.infoPanelVisibleSet(!this.frame.isInfoPanelVisible());
  }

  /** Shows the main toolbar when hidden and hides it when shown. */
  toolbarToggle(): void {
    this.frame.toolbarVisibleSet(!this.frame.isToolbarVisible());
  }

  /** Shows the left vertical tools palette when hidden and hides it when shown. */
  toolsPaletteToggle(): void {
    this.frame.toolsPaletteVisibleSet(!this.frame.isToolsPaletteVisible());
  }

  /**
   * Returns whether the inspector is shown.
   *
   * @returns True while shown.
   */
  isInspectorVisible(): boolean {
    return this.frame.isInspectorVisible();
  }

  /**
   * Returns whether the info panel is shown.
   *
   * @returns True while shown.
   */
  isInfoPanelVisible(): boolean {
    return this.frame.isInfoPanelVisible();
  }

  /**
   * Returns whether the main toolbar is shown.
   *
   * @returns True while shown.
   */
  isToolbarVisible(): boolean {
    return this.frame.isToolbarVisible();
  }

  /**
   * Returns whether the left vertical tools palette is shown.
   *
   * @returns True while shown.
   */
  isToolsPaletteVisible(): boolean {
    return this.frame.isToolsPaletteVisible();
  }
}
