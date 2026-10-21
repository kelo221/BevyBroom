import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { createAddMenuEntries } from '@/layout/setup/add_menu_entries.js';
import { ShellMenu, type ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';

/** Add menu: every registered object kind, grouped by category. */
export class ShellMenuAdd extends ShellMenu {
  readonly label = 'Add';

  /**
   * Builds the Add menu entries from the add menu section registry.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu entries.
   */
  entriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    return createAddMenuEntries(context.toolbarActions);
  }
}
