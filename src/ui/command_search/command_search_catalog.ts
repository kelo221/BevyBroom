import {
  isMenuAction,
  isMenuSubmenu,
  menuActionShortcutTextResolve,
  type ToolbarMenuAction,
  type ToolbarMenuEntry,
} from '@/ui/menu/menu_types.js';
import type { CommandSearchItem, CommandSearchMenuSource } from '@/ui/command_search/command_search_item.js';

/** Separator between the parts of a command key. */
const COMMAND_SEARCH_KEY_SEPARATOR = '\u203a';

/**
 * Collects every command row of a set of menus, including the rows inside their
 * submenus, as searchable commands.
 */
export class CommandSearchCatalog {
  /**
   * Collects the commands of every menu in menu order.
   *
   * @param sources Menus to collect from.
   * @returns Commands with their menu paths.
   */
  static itemsCollect(sources: readonly CommandSearchMenuSource[]): CommandSearchItem[] {
    const items: CommandSearchItem[] = [];
    for (const source of sources) {
      CommandSearchCatalog.entriesCollect(source.entriesBuild(), [source.label], items);
    }
    return items;
  }

  /**
   * Adds the commands of some entries and of their submenus.
   *
   * @param entries Menu entries.
   * @param path Menu titles leading to the entries.
   * @param items Receives the commands.
   */
  private static entriesCollect(
    entries: readonly ToolbarMenuEntry[],
    path: readonly string[],
    items: CommandSearchItem[],
  ): void {
    for (const entry of entries) {
      if (isMenuSubmenu(entry)) {
        const children = entry.childrenResolve?.() ?? entry.children;
        CommandSearchCatalog.entriesCollect(children, [...path, entry.label], items);
      } else if (isMenuAction(entry)) {
        items.push(CommandSearchCatalog.itemCreate(entry, path));
      }
    }
  }

  /**
   * Creates the command of one action row.
   *
   * @param action Action row.
   * @param path Menu titles leading to the row.
   * @returns Command.
   */
  private static itemCreate(action: ToolbarMenuAction, path: readonly string[]): CommandSearchItem {
    return {
      key: [...path, action.label].join(COMMAND_SEARCH_KEY_SEPARATOR),
      label: action.label,
      path,
      shortcut: menuActionShortcutTextResolve(action),
      isEnabled: () => action.isEnabled?.() !== false,
      run: () => action.onClick(),
    };
  }
}
