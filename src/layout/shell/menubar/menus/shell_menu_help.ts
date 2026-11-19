import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { ShellMenu, type ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';

/**
 * Help menu: command search, documentation, about, the MCP server, debug
 * captures and sound.
 */
export class ShellMenuHelp extends ShellMenu {
  readonly label = 'Help';

  /**
   * Builds the Help menu entries.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu entries.
   */
  entriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const actions = context.toolbarActions;
    return [
      ...this.commandSearchEntriesBuild(context),
      this.actionEntry(context, 'Documentation', () => actions.onOpenDocumentation()),
      this.actionEntry(context, 'About BevyBroom…', () => actions.onOpenAboutDialog(), {
        nativeApplicationSlot: 'about',
      }),
      this.separatorEntry(),
      this.actionEntry(context, 'MCP Server Settings…', () => actions.onOpenMcpSettings()),
    ];
  }

  /**
   * Builds the Search Commands entry and its separator when the window offers a
   * command search.
   *
   * @param context Actions and docks the entries run.
   * @returns Search entry and separator, or nothing.
   */
  private commandSearchEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    const commandSearchOpen = context.commandSearchOpen;
    if (!commandSearchOpen) {
      return [];
    }
    return [
      this.actionEntry(context, 'Search Commands…', () => commandSearchOpen(), { shortcutAction: 'command_search' }),
      this.separatorEntry(),
    ];
  }
}
