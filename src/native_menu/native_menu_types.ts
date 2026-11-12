import type { ToolbarMenuNativeApplicationSlot, ToolbarMenuNativeRole } from '@/ui/menu/menu_types.js';

/** Clickable row of a native menu, sent from the page to the desktop host. */
export interface NativeMenuItemActionWire {
  readonly kind: 'action';
  /** Visible row text. */
  readonly label: string;
  /** Id the host sends back when the row is chosen. */
  readonly actionId: string;
  /** Whether the row can be chosen. */
  readonly enabled: boolean;
  /** Whether the row shows a check mark. */
  readonly checked: boolean;
  /** Key equivalent such as "command+shift+s", when the row has one. */
  readonly accelerator?: string;
}

/** Row a native menu fills with a system role instead of a page action. */
export interface NativeMenuItemRoleWire {
  readonly kind: 'role';
  /** Visible row text. */
  readonly label: string;
  /** System role run by the row. */
  readonly role: ToolbarMenuNativeRole;
  /** Key equivalent of the role. */
  readonly accelerator: string;
}

/** Horizontal rule between rows of a native menu. */
export interface NativeMenuItemSeparatorWire {
  readonly kind: 'separator';
}

/** Row that opens a nested native menu. */
export interface NativeMenuItemSubmenuWire {
  readonly kind: 'submenu';
  /** Visible row text. */
  readonly label: string;
  /** Whether the submenu can open. */
  readonly enabled: boolean;
  /** Rows of the nested menu. */
  readonly items: readonly NativeMenuItemWire[];
}

/** One row of a native menu. */
export type NativeMenuItemWire =
  NativeMenuItemActionWire | NativeMenuItemRoleWire | NativeMenuItemSeparatorWire | NativeMenuItemSubmenuWire;

/** One top-level menu of the native menu bar. */
export interface NativeMenuWire {
  /** Menu title shown in the menu bar. */
  readonly label: string;
  /** Rows of the menu. */
  readonly items: readonly NativeMenuItemWire[];
}

/** Row placed into a slot of the macOS application menu. */
export interface NativeMenuApplicationItemWire {
  /** Application menu slot. */
  readonly slot: ToolbarMenuNativeApplicationSlot;
  /** Clickable row. */
  readonly item: NativeMenuItemActionWire;
}

/** Complete native menu bar sent from the page to the desktop host. */
export interface NativeMenuBarWire {
  /** Rows of the application menu, in slot order. */
  readonly applicationItems: readonly NativeMenuApplicationItemWire[];
  /** Menus after the application menu, in menu bar order. */
  readonly menus: readonly NativeMenuWire[];
}

/** Request that the page runs the action of a native menu row. */
export interface NativeMenuActionRunParams {
  /** Id of the chosen row. */
  readonly actionId: string;
}
