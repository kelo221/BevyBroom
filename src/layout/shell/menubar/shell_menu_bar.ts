import type { Toolbar } from '@/ui/toolbar/toolbar.js';
import type { CommandSearchMenuSource } from '@/ui/command_search/command_search_item.js';
import type { ShellMenu, ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';
import { ShellMenuFile } from '@/layout/shell/menubar/menus/shell_menu_file.js';
import { ShellMenuEdit } from '@/layout/shell/menubar/menus/shell_menu_edit.js';
import { ShellMenuAdd } from '@/layout/shell/menubar/menus/shell_menu_add.js';
import { ShellMenuTools } from '@/layout/shell/menubar/menus/shell_menu_tools.js';
import { ShellMenuView } from '@/layout/shell/menubar/menus/shell_menu_view.js';
import { ShellMenuRun } from '@/layout/shell/menubar/menus/shell_menu_run.js';
import { ShellMenuHelp } from '@/layout/shell/menubar/menus/shell_menu_help.js';

/**
 * Creates the main window menus in menu bar order.
 *
 * @returns File, Edit, Add, Tools, View, Run and Help menus.
 */
export function shellMenusBuiltinCreate(): ShellMenu[] {
  return [
    new ShellMenuFile(),
    new ShellMenuEdit(),
    new ShellMenuAdd(),
    new ShellMenuTools(),
    new ShellMenuView(),
    new ShellMenuRun(),
    new ShellMenuHelp(),
  ];
}

/**
 * Adds one dropdown per menu to a menu bar.
 *
 * @param menuBar Menu bar receiving the menus.
 * @param menus Menus in display order.
 * @param context Actions and docks the menu entries run.
 */
export function shellMenuBarPopulate(menuBar: Toolbar, menus: readonly ShellMenu[], context: ShellMenuContext): void {
  menus.forEach((menu) => {
    menuBar.addDropdown(menu.label, menu.entriesBuild(context));
  });
}

/**
 * Describes the menus as command search sources whose entries are built anew
 * every time the search opens.
 *
 * @param menus Menus in menu bar order.
 * @param context Actions and docks the menu entries run.
 * @returns One command search source per menu.
 */
export function shellMenusCommandSearchSourcesCreate(
  menus: readonly ShellMenu[],
  context: ShellMenuContext,
): CommandSearchMenuSource[] {
  return menus.map((menu) => ({ label: menu.label, entriesBuild: () => menu.entriesBuild(context) }));
}
