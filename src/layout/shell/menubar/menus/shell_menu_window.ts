import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import type { KeyboardShortcutAction } from '@/settings/store/settings_types.js';
import type { ShellFloatingWindowId } from '@/layout/shell/actions/shell_floating_window.js';
import { ShellMenu, type ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';

/** One browser window of the Window menu: its id, row label and shortcut. */
interface ShellMenuWindowBrowser {
  readonly windowId: ShellFloatingWindowId;
  readonly label: string;
  readonly shortcutAction: KeyboardShortcutAction;
}

/** Browser windows listed at the top of the Window menu. */
export const SHELL_MENU_WINDOW_BROWSERS: readonly ShellMenuWindowBrowser[] = [
  { windowId: 'texture_browser', label: 'Texture Browser', shortcutAction: 'window_texture_browser' },
  { windowId: 'entity_browser', label: 'Entity Browser', shortcutAction: 'window_entity_browser' },
  { windowId: 'level_browser', label: 'Level Browser', shortcutAction: 'window_level_browser' },
];

/** Window menu row that arranges the open floating windows side by side. */
export const SHELL_MENU_WINDOW_TILE_LABEL = 'Tile Floating Windows';

/** Window menu row that floats every tool window at its default place and size. */
export const SHELL_MENU_WINDOW_RESET_LABEL = 'Reset Window Layout';

/**
 * Window menu: every window and panel the editor opens, in one place. The
 * browsers come first, then the inspector pages and tool panels, then extra
 * views and debug windows, then the window layout commands.
 */
export class ShellMenuWindow extends ShellMenu {
  readonly label = 'Window';

  /**
   * Builds the Window menu entries.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu entries.
   */
  entriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const actions = context.toolbarActions;
    return [
      ...SHELL_MENU_WINDOW_BROWSERS.map((browser) => this.browserEntryBuild(context, browser)),
      this.separatorEntry(),
      this.mapInspectorEntryBuild(context),
      this.actionEntry(context, 'Solid Model…', () => actions.onToggleSolidModelPanel()),
      this.separatorEntry(),
      this.actionEntry(context, 'Detached Viewport…', () => actions.onOpenDetachedViewport()),
      this.separatorEntry(),
      this.actionEntry(context, 'AI Captures (Debug)…', () => actions.onToggleAiCaptureDebugPanel()),
      this.separatorEntry(),
      this.actionEntry(context, SHELL_MENU_WINDOW_TILE_LABEL, () => context.dockCommands.floatingWindowsTile()),
      this.actionEntry(context, SHELL_MENU_WINDOW_RESET_LABEL, () => context.dockCommands.toolWindowLayoutReset()),
    ];
  }

  /**
   * Builds the row that opens or closes one browser window, checked while open.
   *
   * @param context Actions and docks the entries run.
   * @param browser Browser window of the row.
   * @returns Menu action entry.
   */
  private browserEntryBuild(context: ShellMenuContext, browser: ShellMenuWindowBrowser): ToolbarMenuEntry {
    const docks = context.dockCommands;
    return this.actionEntry(context, browser.label, () => docks.floatingWindowToggle(browser.windowId), {
      shortcutAction: browser.shortcutAction,
      isChecked: () => docks.isFloatingWindowOpen(browser.windowId),
    });
  }

  /**
   * Builds the row that reveals the Map page of the inspector, checked while
   * the inspector is shown.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu action entry.
   */
  private mapInspectorEntryBuild(context: ShellMenuContext): ToolbarMenuEntry {
    const docks = context.dockCommands;
    return this.actionEntry(context, 'Map Inspector', () => docks.inspectorReveal(), {
      shortcutAction: 'inspector_map',
      isChecked: () => docks.isInspectorVisible(),
    });
  }
}
