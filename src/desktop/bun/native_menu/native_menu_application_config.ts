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

/**
 * Builds the standard macOS Window menu.
 *
 * @returns Window menu item.
 */
function nativeMenuApplicationWindowMenuConfig(): NativeMenuApplicationConfigItem {
  return {
    label: 'Window',
    submenu: [
      { role: 'minimize', accelerator: 'command+m' },
      { role: 'zoom' },
      { role: 'toggleFullScreen', accelerator: 'command+control+f' },
      { type: 'divider' },
      { role: 'bringAllToFront' },
    ],
  };
}

/**
 * Converts a page menu bar into the complete application menu: the app menu,
 * the page menus, and a Window menu placed before Help.
 *
 * @param bar Page menu bar.
 * @param applicationName Name shown in the application menu.
 * @returns Application menu configuration.
 */
export function nativeMenuApplicationConfigBuild(
  bar: NativeMenuBarWire,
  applicationName: string,
): NativeMenuApplicationConfigItem[] {
  const pageMenus = bar.menus.map(nativeMenuApplicationMenuConfig);
  const helpIndex = bar.menus.findIndex((menu) => menu.label === 'Help');
  const windowInsertIndex = helpIndex < 0 ? pageMenus.length : helpIndex;
  pageMenus.splice(windowInsertIndex, 0, nativeMenuApplicationWindowMenuConfig());
  return [nativeMenuApplicationAppMenuConfig(bar, applicationName), ...pageMenus];
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
