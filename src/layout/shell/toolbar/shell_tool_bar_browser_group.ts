import type { Toolbar } from '@/ui/toolbar/toolbar.js';
import { IconHammerCatalog } from '@/ui/icons/hammer/icon_hammer_catalog.js';
import type { IconHammerToolbarBrowserName } from '@/ui/icons/hammer/toolbar/icon_hammer_toolbar_browser.js';
import type { ShellDockCommands } from '@/layout/shell/actions/shell_dock_commands.js';
import type { ShellWindowActions } from '@/layout/shell/actions/shell_window_actions.js';
import { SHELL_MENU_WINDOW_BROWSERS } from '@/layout/shell/menubar/menus/shell_menu_window.js';
import type { ShellFloatingWindowId } from '@/layout/shell/actions/shell_floating_window.js';

/** Dock commands the browser buttons open, close and follow the windows with. */
export type ShellToolBarBrowserDocks = Pick<
  ShellDockCommands,
  'floatingWindowToggle' | 'isFloatingWindowOpen' | 'floatingWindowOpenChangeListenerAdd'
>;

/** Toolbar icon of each browser window. */
const SHELL_TOOL_BAR_BROWSER_ICONS: Readonly<Record<ShellFloatingWindowId, IconHammerToolbarBrowserName>> = {
  texture_browser: 'browser_texture',
  entity_browser: 'browser_entity',
  level_browser: 'browser_level',
};

/**
 * Toolbar buttons that open and close the browser windows of the Window menu.
 * Each button is highlighted while its window is open.
 */
export class ShellToolBarBrowserGroup {
  /**
   * Adds one button per browser window and keeps their highlight in step with
   * the windows for as long as the dock commands live.
   *
   * @param toolbar Main toolbar.
   * @param docks Dock commands that open and close the windows.
   * @param windowActions Window actions that read the shortcut labels when the
   *   pointer reaches a button, so rebound shortcuts show and nothing is read
   *   while the window is still being built.
   */
  static add(toolbar: Toolbar, docks: ShellToolBarBrowserDocks, windowActions: ShellWindowActions): void {
    for (const browser of SHELL_MENU_WINDOW_BROWSERS) {
      const iconSvg = IconHammerCatalog.toolbarSvg(SHELL_TOOL_BAR_BROWSER_ICONS[browser.windowId]);
      const button = toolbar.addIconButton(browser.label, iconSvg, () => docks.floatingWindowToggle(browser.windowId));
      button.title = browser.label;
      button.addEventListener('pointerenter', () => {
        button.title = ShellToolBarBrowserGroup.titleCompose(
          browser.label,
          windowActions.shortcutLabelRead(browser.shortcutAction),
        );
      });
      toolbar.setButtonActiveByLabel(browser.label, docks.isFloatingWindowOpen(browser.windowId));
    }
    docks.floatingWindowOpenChangeListenerAdd((windowId, isOpen) =>
      ShellToolBarBrowserGroup.highlightSet(toolbar, windowId, isOpen),
    );
  }

  /**
   * Highlights the button of a browser window while it is open.
   *
   * @param toolbar Main toolbar.
   * @param windowId Floating window id.
   * @param isOpen Whether the window is open now.
   */
  private static highlightSet(toolbar: Toolbar, windowId: ShellFloatingWindowId, isOpen: boolean): void {
    const browser = SHELL_MENU_WINDOW_BROWSERS.find((candidate) => candidate.windowId === windowId);
    if (browser) {
      toolbar.setButtonActiveByLabel(browser.label, isOpen);
    }
  }

  /**
   * Builds the hover text of a browser button.
   *
   * @param label Browser name.
   * @param shortcutLabel Shortcut text, or empty when unbound.
   * @returns Hover text such as "Entity Browser (⌘⇧B)".
   */
  private static titleCompose(label: string, shortcutLabel: string): string {
    return shortcutLabel === '' ? label : `${label} (${shortcutLabel})`;
  }
}
