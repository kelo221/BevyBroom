import { PanelFloatingContentHost } from '@/ui/floating_panel/panel_floating_content_host.js';
import type { LevelBrowser } from './level_browser.js';

/**
 * Floating level browser window: the levels of the open project, opened by
 * double-click or Open, with New Level, Save As New and Rename. Opening the
 * window lists the levels again.
 */
export class PanelFloatingLevelBrowser extends PanelFloatingContentHost {
  private readonly levelBrowser: LevelBrowser;

  /**
   * Creates the level browser window around a level browser.
   *
   * @param host Parent element of floating windows.
   * @param levelBrowser Level browser shown in the window.
   */
  constructor(host: HTMLElement, levelBrowser: LevelBrowser) {
    super(
      host,
      {
        titleText: 'Level Browser',
        className: 'panel-floating-level-browser',
        width: '420px',
        height: '400px',
        corner: 'bottom-left',
        centered: true,
      },
      levelBrowser.getElement(),
    );
    this.levelBrowser = levelBrowser;
    this.openChangeListenerAdd((isOpen) => this.refreshWhenOpened(isOpen));
  }

  /**
   * Returns the level browser shown in the window.
   *
   * @returns Level browser.
   */
  levelBrowserRead(): LevelBrowser {
    return this.levelBrowser;
  }

  /**
   * Shows the window and puts the keyboard focus into the list, or into the
   * name field when a new level is to be named.
   *
   * @param isNameFieldFocused True to focus the name field.
   */
  reveal(isNameFieldFocused: boolean): void {
    this.show();
    const focused = isNameFieldFocused ? this.levelBrowser.nameInputRead() : this.levelBrowser.listElementRead();
    focused.focus();
  }

  /**
   * Lists the levels again after the window opened.
   *
   * @param isOpen Whether the window is open now.
   */
  private refreshWhenOpened(isOpen: boolean): void {
    if (isOpen) {
      this.levelBrowser.refresh();
    }
  }
}
