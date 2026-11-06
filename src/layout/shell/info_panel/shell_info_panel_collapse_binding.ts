import type { ShellFrame } from '@/layout/shell/frame/shell_frame.js';
import type { ShellInfoPanel, ShellInfoPanelStripClick } from './shell_info_panel.js';

/**
 * Folds and unfolds the info panel from clicks on its strip: a tab or a
 * revealing element unfolds a folded panel, and the shown tab folds an unfolded
 * one. Keeps the panel's folded look in step with the frame.
 */
export class ShellInfoPanelCollapseBinding {
  private readonly frame: ShellFrame;
  private readonly infoPanel: ShellInfoPanel;
  private readonly listenerRemovers: Array<() => void>;

  /**
   * Binds the info panel strip to the frame that folds the panel.
   *
   * @param frame Main window skeleton that folds and unfolds the panel.
   * @param infoPanel Bottom info panel.
   */
  constructor(frame: ShellFrame, infoPanel: ShellInfoPanel) {
    this.frame = frame;
    this.infoPanel = infoPanel;
    this.listenerRemovers = [
      frame.visibilityListenerAdd(() => this.collapsedLookSync()),
      infoPanel.stripClickListenerAdd((click) => this.stripClickHandle(click)),
    ];
    this.collapsedLookSync();
  }

  /** Stops following the frame and the strip clicks. */
  dispose(): void {
    this.listenerRemovers.forEach((listenerRemove) => listenerRemove());
    this.listenerRemovers.length = 0;
  }

  /** Shows the panel folded or unfolded the way the frame lays it out. */
  private collapsedLookSync(): void {
    this.infoPanel.collapsedApply(this.frame.isInfoPanelCollapsed());
  }

  /**
   * Folds or unfolds the panel for one strip click and shows the tab a
   * revealing element names.
   *
   * @param click Strip click.
   */
  private stripClickHandle(click: ShellInfoPanelStripClick): void {
    const isCollapsed = this.frame.isInfoPanelCollapsed();
    if (isCollapsed) {
      this.frame.infoPanelCollapsedSet(false);
    } else if (click.isTabButton && click.wasActiveTab) {
      this.frame.infoPanelCollapsedSet(true);
    }
    if (!click.isTabButton) {
      this.infoPanel.tabShow(click.tabId);
    }
  }
}
