import type {
  NativeMenuBarWire,
  NativeMenuItemActionWire,
  NativeMenuItemWire,
  NativeMenuWire,
} from '@/native_menu/native_menu_types.js';

/** Prefix of the native action string of a page menu row. */
export const NATIVE_MENU_APPLICATION_ACTION_PREFIX = 'page:';

/** One item of the Electrobun application menu configuration. */
export type NativeMenuApplicationConfigItem =
  | { type: 'divider' }
  | {
      label?: string;
      action?: string;
      role?: string;
      enabled?: boolean;
      checked?: boolean;
      accelerator?: string;
      submenu?: NativeMenuApplicationConfigItem[];
    };

/**
 * Converts a page action row to an application menu item.
 *
 * @param item Page action row.
 * @returns Application menu item.
 */
function nativeMenuApplicationActionConfig(item: NativeMenuItemActionWire): NativeMenuApplicationConfigItem {
  return {
    label: item.label,
    action: `${NATIVE_MENU_APPLICATION_ACTION_PREFIX}${item.actionId}`,
    enabled: item.enabled,
    checked: item.checked,
    ...(item.accelerator ? { accelerator: item.accelerator } : {}),
  };
}

/**
 * Converts one page menu row to an application menu item.
 *
 * @param item Page menu row.
 * @returns Application menu item.
 */
export function nativeMenuApplicationItemConfig(item: NativeMenuItemWire): NativeMenuApplicationConfigItem {
  switch (item.kind) {
    case 'separator':
      return { type: 'divider' };
    case 'role':
      return { label: item.label, role: item.role, accelerator: item.accelerator };
    case 'submenu':
      return { label: item.label, enabled: item.enabled, submenu: item.items.map(nativeMenuApplicationItemConfig) };
    default:
      return nativeMenuApplicationActionConfig(item);
  }
}

/**
 * Converts one page menu to a top-level application menu.
 *
 * @param menu Page menu.
 * @returns Top-level application menu item.
 */
function nativeMenuApplicationMenuConfig(menu: NativeMenuWire): NativeMenuApplicationConfigItem {
  return { label: menu.label, submenu: menu.items.map(nativeMenuApplicationItemConfig) };
}

/**
 * Builds the macOS application menu: the page's About and Settings rows
 * followed by the standard Hide and Quit rows.
 *
 * @param bar Page menu bar.
 * @param applicationName Name shown in the application menu.
 * @returns Application menu item.
 */
function nativeMenuApplicationAppMenuConfig(
  bar: NativeMenuBarWire,
  applicationName: string,
): NativeMenuApplicationConfigItem {
  const pageItems = bar.applicationItems.map((entry) => nativeMenuApplicationActionConfig(entry.item));
  return {
    label: applicationName,
    submenu: [
      ...pageItems,
      { type: 'divider' },
      { role: 'hide', accelerator: 'command+h' },
      { role: 'hideOthers', accelerator: 'command+option+h' },
      { role: 'showAll' },
      { type: 'divider' },
      { role: 'quit', accelerator: 'command+q' },
    ],
  };
}

/** Name of the page menu that receives the standard macOS window rows. */
export const NATIVE_MENU_APPLICATION_WINDOW_LABEL = 'Window';

/**
 * Returns the standard macOS rows that size and arrange the window.
 *
 * @returns Minimize, Zoom and Full Screen rows.
 */
function nativeMenuApplicationWindowRoleItems(): NativeMenuApplicationConfigItem[] {
  return [
    { role: 'minimize', accelerator: 'command+m' },
    { role: 'zoom' },
    { role: 'toggleFullScreen', accelerator: 'command+control+f' },
  ];
}

/**
 * Builds the macOS Window menu: the standard window rows, then the page's own
 * Window rows when it has any, then Bring All to Front.
 *
 * @param pageItems Rows of the page's Window menu; empty when it has none.
 * @returns Window menu item.
 */
function nativeMenuApplicationWindowMenuConfig(
  pageItems: readonly NativeMenuApplicationConfigItem[],
): NativeMenuApplicationConfigItem {
  const pageSection = pageItems.length > 0 ? [{ type: 'divider' } as const, ...pageItems] : [];
  return {
    label: NATIVE_MENU_APPLICATION_WINDOW_LABEL,
    submenu: [
      ...nativeMenuApplicationWindowRoleItems(),
      ...pageSection,
      { type: 'divider' },
      { role: 'bringAllToFront' },
    ],
  };
}

/**
 * Converts a page menu bar into the complete application menu: the app menu,
 * the page menus, and one Window menu that holds the standard window rows and
 * the page's own Window rows, placed where the page's Window menu is or else
 * before Help.
 *
 * @param bar Page menu bar.
 * @param applicationName Name shown in the application menu.
 * @returns Application menu configuration.
 */
export function nativeMenuApplicationConfigBuild(
  bar: NativeMenuBarWire,
  applicationName: string,
): NativeMenuApplicationConfigItem[] {
  const pageWindowMenu = bar.menus.find((menu) => menu.label === NATIVE_MENU_APPLICATION_WINDOW_LABEL);
  const otherMenus = bar.menus.filter((menu) => menu !== pageWindowMenu);
  const pageMenus = otherMenus.map(nativeMenuApplicationMenuConfig);
  const windowItems = pageWindowMenu ? pageWindowMenu.items.map(nativeMenuApplicationItemConfig) : [];
  const insertIndex = nativeMenuApplicationWindowInsertIndex(bar.menus, pageWindowMenu);
  pageMenus.splice(insertIndex, 0, nativeMenuApplicationWindowMenuConfig(windowItems));
  return [nativeMenuApplicationAppMenuConfig(bar, applicationName), ...pageMenus];
}

/**
 * Returns where the Window menu goes among the page menus without the page's
 * own Window menu: its own place when the page has one, otherwise before Help
 * or at the end.
 *
 * @param menus Page menus in bar order.
 * @param pageWindowMenu The page's Window menu, or undefined.
 * @returns Insert index.
 */
function nativeMenuApplicationWindowInsertIndex(
  menus: readonly NativeMenuWire[],
  pageWindowMenu: NativeMenuWire | undefined,
): number {
  if (pageWindowMenu) {
    return menus.indexOf(pageWindowMenu);
  }
  const helpIndex = menus.findIndex((menu) => menu.label === 'Help');
  return helpIndex < 0 ? menus.length : helpIndex;
}

/**
 * Reads the page action id from a native action string.
 *
 * @param action Native action string of a clicked row.
 * @returns Page action id, or null for rows the page does not own.
 */
export function nativeMenuApplicationActionIdRead(action: string): string | null {
  return action.startsWith(NATIVE_MENU_APPLICATION_ACTION_PREFIX)
    ? action.slice(NATIVE_MENU_APPLICATION_ACTION_PREFIX.length)
    : null;
}
