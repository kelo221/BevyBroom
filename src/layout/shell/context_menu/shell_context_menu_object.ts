import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { ShellMenu, type ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';
import { ShellMenuEdit } from '@/layout/shell/menubar/menus/shell_menu_edit.js';
import { ShellMenuView } from '@/layout/shell/menubar/menus/shell_menu_view.js';

/**
 * Right-click menu of the map views. On selected objects it lists what acts on
 * them: clipboard, Duplicate, Delete, Object Properties, grouping, the brush
 * operations, Align, visibility and framing. On empty space it lists pasting,
 * selecting and Show All. Every row is the same row the main menus build, so
 * labels, shortcuts and enablement match the menu bar.
 */
export class ShellContextMenuObject extends ShellMenu {
  readonly label = 'Object';
  private readonly editMenu = new ShellMenuEdit();
  private readonly viewMenu = new ShellMenuView();

  /**
   * Builds the entries for the current selection.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu entries; rows that do not apply now still need filtering.
   */
  entriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    if (context.windowActions.selectionHasObjectsIs()) {
      return this.selectionEntriesBuild(context);
    }
    return this.emptySpaceEntriesBuild(context);
  }

  /**
   * Builds the entries that act on selected objects.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu entries.
   */
  private selectionEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    return [
      ...this.editMenu.clipboardEntriesBuild(context),
      this.separatorEntry(),
      ...this.editMenu.objectEntriesBuild(context),
      this.separatorEntry(),
      ...this.editMenu.groupEntriesBuild(context),
      this.separatorEntry(),
      ...this.editMenu.csgEntriesBuild(context),
      this.editMenu.alignSubmenuBuild(context),
      this.separatorEntry(),
      ...this.viewMenu.visibilityEntriesBuild(context),
      this.viewMenu.frameSelectionEntryBuild(context),
    ];
  }

  /**
   * Builds the entries for a right-click on empty space.
   *
   * @param context Actions and docks the entries run.
   * @returns Menu entries.
   */
  private emptySpaceEntriesBuild(context: ShellMenuContext): ToolbarMenuEntry[] {
    return [
      ...this.editMenu.clipboardEntriesBuild(context),
      this.separatorEntry(),
      ...this.editMenu.selectionEntriesBuild(context),
      this.separatorEntry(),
      ...this.viewMenu.visibilityEntriesBuild(context),
    ];
  }
}
