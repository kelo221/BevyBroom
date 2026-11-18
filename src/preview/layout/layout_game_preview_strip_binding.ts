import type { ShellInfoPanel, ShellInfoPanelTabId } from '@/layout/shell/info_panel/shell_info_panel.js';
import type { LayoutGamePreview } from './layout_game_preview.js';

/** Bottom strip tab that holds the Game Preview page. */
export const LAYOUT_GAME_PREVIEW_STRIP_TAB_ID: ShellInfoPanelTabId = 'preview';

/**
 * Tells the game preview layout when the Game Preview tab of the bottom strip
 * comes to the front or leaves it, so its page is built on first view and
 * refreshes only while it is in front.
 */
export class LayoutGamePreviewStripBinding {
  private readonly layoutEnsure: () => LayoutGamePreview;
  private readonly removeTabChangeListener: () => void;

  /**
   * Starts following the bottom strip tabs; shows the page at once when the
   * strip already has the Game Preview tab in front.
   *
   * @param infoPanel Bottom strip whose tabs are followed.
   * @param layoutEnsure Returns the game preview layout, creating it on first
   *   use.
   */
  constructor(
    infoPanel: Pick<ShellInfoPanel, 'tabChangeListenerAdd' | 'activeTabIdRead'>,
    layoutEnsure: () => LayoutGamePreview,
  ) {
    this.layoutEnsure = layoutEnsure;
    this.removeTabChangeListener = infoPanel.tabChangeListenerAdd((tabId) => this.tabChanged(tabId));
    if (infoPanel.activeTabIdRead() === LAYOUT_GAME_PREVIEW_STRIP_TAB_ID) {
      this.tabChanged(LAYOUT_GAME_PREVIEW_STRIP_TAB_ID);
    }
  }

  /** Stops following the bottom strip tabs. */
  dispose(): void {
    this.removeTabChangeListener();
  }

  /**
   * Shows or hides the Game Preview page for the tab now in front.
   *
   * @param tabId Bottom strip tab now in front.
   */
  private tabChanged(tabId: string): void {
    this.layoutEnsure().panelShownSet(tabId === LAYOUT_GAME_PREVIEW_STRIP_TAB_ID);
  }
}
