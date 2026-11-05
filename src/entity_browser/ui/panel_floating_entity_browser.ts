import { PanelFloatingContentHost } from '@/ui/floating_panel/panel_floating_content_host.js';
import type { EntityBrowser } from './entity_browser.js';

/**
 * Floating entity browser window: the grid of every placeable kind, whose tiles
 * are dragged onto a viewport or double-clicked to add them. Opening the window
 * refreshes the Used counts.
 */
export class PanelFloatingEntityBrowser extends PanelFloatingContentHost {
  private readonly entityBrowser: EntityBrowser;

  /**
   * Creates the entity browser window around an entity browser.
   *
   * @param host Parent element of floating windows.
   * @param entityBrowser Entity browser shown in the window.
   */
  constructor(host: HTMLElement, entityBrowser: EntityBrowser) {
    super(
      host,
      {
        titleText: 'Entity Browser',
        className: 'panel-floating-entity-browser',
        width: '360px',
        height: '520px',
        corner: 'bottom-right',
        centered: true,
      },
      entityBrowser.getElement(),
    );
    this.entityBrowser = entityBrowser;
    this.openChangeListenerAdd((isOpen) => this.usageRefreshWhenOpened(isOpen));
  }

  /**
   * Returns the entity browser shown in the window.
   *
   * @returns Entity browser.
   */
  entityBrowserRead(): EntityBrowser {
    return this.entityBrowser;
  }

  /**
   * Refreshes the Used counts of the browser after the window opened.
   *
   * @param isOpen Whether the window is open now.
   */
  private usageRefreshWhenOpened(isOpen: boolean): void {
    if (isOpen) {
      this.entityBrowser.usageRefresh();
    }
  }
}
