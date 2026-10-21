import type { ShellFrame } from '@/layout/shell/frame/shell_frame.js';
import type { ShellInspector, ShellInspectorTabId } from '@/layout/shell/inspector/shell_inspector.js';
import type { ShellInfoPanel, ShellInfoPanelTabId } from '@/layout/shell/info_panel/shell_info_panel.js';

/** Commands that show, hide and switch the main window docks. */
export class ShellDockCommands {
  private readonly frame: ShellFrame;
  private readonly inspector: ShellInspector;
  private readonly infoPanel: ShellInfoPanel;

  /**
   * Creates dock commands over the main window docks.
   *
   * @param frame Main window skeleton that shows and hides the docks.
   * @param inspector Right-hand inspector.
   * @param infoPanel Bottom info panel.
   */
  constructor(frame: ShellFrame, inspector: ShellInspector, infoPanel: ShellInfoPanel) {
    this.frame = frame;
    this.inspector = inspector;
    this.infoPanel = infoPanel;
  }

  /**
   * Shows the inspector with one tab in front.
   *
   * @param tabId Inspector tab to show.
   */
  inspectorTabReveal(tabId: ShellInspectorTabId): void {
    if (!this.frame.isInspectorVisible()) {
      this.frame.inspectorVisibleSet(true);
    }
    this.inspector.tabShow(tabId);
  }

  /**
   * Returns whether the inspector is shown with one tab in front.
   *
   * @param tabId Inspector tab.
   * @returns True when that tab is visible.
   */
  isInspectorTabShown(tabId: ShellInspectorTabId): boolean {
    return this.frame.isInspectorVisible() && this.inspector.activeTabIdRead() === tabId;
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
}
