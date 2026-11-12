/**
 * Declarative menu entries for toolbar dropdowns and nested flyout menus.
 * Action items may omit `kind` for a compact authoring style.
 */

import type { IconName } from '@/ui/icons/icon_name.js';
import type { KeyboardShortcut } from '@/settings/store/settings_types.js';

/** System menu roles a native menu bar can run instead of a row's action. */
export type ToolbarMenuNativeRole = 'cut' | 'copy' | 'paste';

/** Slots of the macOS application menu a row moves into in a native menu bar. */
export type ToolbarMenuNativeApplicationSlot = 'about' | 'settings';

/** Text editing commands that replace a row's action inside text fields. */
export type ToolbarMenuTextEditCommand = 'undo' | 'redo' | 'selectAll' | 'delete';

/** Clickable menu row with optional enablement and shortcut label. */
export interface ToolbarMenuAction {
  /** Discriminator; omit or set to action for a normal item. */
  kind?: 'action';
  /** Visible left-side label. */
  label: string;
  /** Invoked when the enabled item is activated. */
  onClick: () => void;
  /**
   * Optional live enablement check evaluated when the menu opens or refreshes.
   * When omitted or true, the item is clickable.
   */
  isEnabled?: () => boolean;
  /**
   * Optional keyboard shortcut shown on the right. A function is re-evaluated
   * whenever the menu refreshes so rebound settings stay accurate.
   */
  shortcut?: string | (() => string | undefined | null);
  /**
   * Optional hover tooltip (native title). A function is re-evaluated whenever
   * the menu refreshes so dynamic help text stays accurate.
   */
  tooltip?: string | (() => string | undefined | null);
  /** Optional icon drawn in front of the label. */
  icon?: IconName;
  /** CSS color of the icon; the icon uses the text color when omitted. */
  iconColor?: string;
  /**
   * Optional live checked state. When present the row shows a check mark slot
   * that is filled while the function returns true.
   */
  isChecked?: () => boolean;
  /**
   * Optional live key binding of the row's shortcut, used by native menu bars
   * for key equivalents.
   */
  shortcutBinding?: () => KeyboardShortcut | undefined;
  /**
   * Optional system role a native menu bar runs instead of the action, so the
   * system sends the matching browser clipboard event.
   */
  nativeRole?: ToolbarMenuNativeRole;
  /**
   * Optional text editing command a native menu bar runs instead of the action
   * while a text field has keyboard focus.
   */
  textEditCommand?: ToolbarMenuTextEditCommand;
  /**
   * Optional slot of the application menu the row moves into in a native menu
   * bar.
   */
  nativeApplicationSlot?: ToolbarMenuNativeApplicationSlot;
}

/** Horizontal rule between menu sections. */
export interface ToolbarMenuSeparator {
  kind: 'separator';
}

/** Parent row that opens a nested flyout of child entries. */
export interface ToolbarMenuSubmenu {
  kind: 'submenu';
  /** Visible left-side label for the parent row. */
  label: string;
  /** Nested entries shown in the flyout. */
  children: ToolbarMenuEntry[];
  /**
   * Optional live source of the nested entries, evaluated whenever the menu
   * opens or refreshes. When present it replaces {@link children}.
   */
  childrenResolve?: () => ToolbarMenuEntry[];
  /**
   * Optional live enablement check for the parent row. When false, the submenu
   * cannot open.
   */
  isEnabled?: () => boolean;
  /**
   * Optional hover tooltip (native title). A function is re-evaluated whenever
   * the menu refreshes.
   */
  tooltip?: string | (() => string | undefined | null);
  /** Optional icon drawn in front of the label. */
  icon?: IconName;
  /** CSS color of the icon; the icon uses the text color when omitted. */
  iconColor?: string;
}

/** One entry in a toolbar dropdown or nested submenu panel. */
export type ToolbarMenuEntry = ToolbarMenuAction | ToolbarMenuSeparator | ToolbarMenuSubmenu;

/**
 * Alias retained for existing call sites that still import
 * {@link ToolbarDropdownItem}.
 */
export type ToolbarDropdownItem = ToolbarMenuEntry;

/**
 * Returns whether the entry is a visual separator.
 *
 * @param entry Menu entry candidate.
 * @returns True when the entry is a separator.
 */
export function isMenuSeparator(entry: ToolbarMenuEntry): entry is ToolbarMenuSeparator {
  return entry.kind === 'separator';
}

/**
 * Returns whether the entry opens a nested submenu.
 *
 * @param entry Menu entry candidate.
 * @returns True when the entry is a submenu parent.
 */
export function isMenuSubmenu(entry: ToolbarMenuEntry): entry is ToolbarMenuSubmenu {
  return entry.kind === 'submenu';
}

/**
 * Returns whether the entry is a clickable action row.
 *
 * @param entry Menu entry candidate.
 * @returns True when the entry is an action.
 */
export function isMenuAction(entry: ToolbarMenuEntry): entry is ToolbarMenuAction {
  return !isMenuSeparator(entry) && !isMenuSubmenu(entry);
}
