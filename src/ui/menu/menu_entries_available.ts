import {
  isMenuSeparator,
  isMenuSubmenu,
  type ToolbarMenuEntry,
  type ToolbarMenuSubmenu,
} from '@/ui/menu/menu_types.js';

/**
 * Returns the entries a context menu shows right now: enabled actions, enabled
 * submenus that keep at least one shown child, and separators only between
 * shown groups. Submenu children are resolved once, so the result no longer
 * changes with the editor state.
 *
 * @param entries Entries to filter.
 * @returns Shown entries.
 */
export function menuEntriesAvailableFilter(entries: readonly ToolbarMenuEntry[]): ToolbarMenuEntry[] {
  const shownEntries: ToolbarMenuEntry[] = [];
  for (const entry of entries) {
    const shownEntry = menuEntryAvailableRead(entry);
    if (shownEntry !== null) {
      shownEntries.push(shownEntry);
    }
  }
  return menuEntriesSeparatorsTrim(shownEntries);
}

/**
 * Returns one entry as shown, or null when it is hidden.
 *
 * @param entry Entry to check.
 * @returns The entry, a submenu with only its shown children, or null.
 */
function menuEntryAvailableRead(entry: ToolbarMenuEntry): ToolbarMenuEntry | null {
  if (isMenuSeparator(entry)) {
    return entry;
  }
  if (isMenuSubmenu(entry)) {
    return menuSubmenuAvailableRead(entry);
  }
  return entry.isEnabled?.() === false ? null : entry;
}

/**
 * Returns a submenu holding only its shown children, or null when it is
 * disabled or none of its children are shown.
 *
 * @param submenu Submenu to check.
 * @returns Submenu with fixed shown children, or null.
 */
function menuSubmenuAvailableRead(submenu: ToolbarMenuSubmenu): ToolbarMenuSubmenu | null {
  if (submenu.isEnabled?.() === false) {
    return null;
  }
  const children = menuEntriesAvailableFilter(submenu.childrenResolve?.() ?? submenu.children);
  if (children.length === 0) {
    return null;
  }
  const { childrenResolve: childrenResolveDropped, ...submenuWithoutResolve } = submenu;
  void childrenResolveDropped;
  return { ...submenuWithoutResolve, children };
}

/**
 * Removes leading, trailing and repeated separators.
 *
 * @param entries Entries that may hold stray separators.
 * @returns Entries with separators only between groups.
 */
function menuEntriesSeparatorsTrim(entries: readonly ToolbarMenuEntry[]): ToolbarMenuEntry[] {
  const trimmedEntries: ToolbarMenuEntry[] = [];
  for (const entry of entries) {
    const previousEntry = trimmedEntries[trimmedEntries.length - 1];
    const isStraySeparator = isMenuSeparator(entry) && (previousEntry === undefined || isMenuSeparator(previousEntry));
    if (!isStraySeparator) {
      trimmedEntries.push(entry);
    }
  }
  const lastEntry = trimmedEntries[trimmedEntries.length - 1];
  if (lastEntry !== undefined && isMenuSeparator(lastEntry)) {
    trimmedEntries.pop();
  }
  return trimmedEntries;
}
