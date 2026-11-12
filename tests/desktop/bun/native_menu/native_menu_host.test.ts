import { describe, expect, it, vi } from 'vitest';
import { NativeMenuHost, type NativeMenuHostApplicationMenu } from '@/desktop/bun/native_menu/native_menu_host.js';
import {
  nativeMenuApplicationConfigBuild,
  type NativeMenuApplicationConfigItem,
} from '@/desktop/bun/native_menu/native_menu_application_config.js';
import { NativeMenuSerializer } from '@/native_menu/native_menu_serializer.js';
import { NativeMenuTestMenus } from '../../../native_menu/native_menu_test_support.js';

/** Application menu fake that keeps the installed menu and the click handler. */
class NativeMenuHostTestApplicationMenu implements NativeMenuHostApplicationMenu {
  installedMenu: NativeMenuApplicationConfigItem[] = [];
  clickHandler: ((event: unknown) => void) | null = null;

  /**
   * Keeps the installed menu.
   *
   * @param menu Application menu configuration.
   */
  setApplicationMenu(menu: NativeMenuApplicationConfigItem[]): void {
    this.installedMenu = menu;
  }

  /**
   * Keeps the click handler.
   *
   * @param _name Event name.
   * @param handler Click handler.
   */
  on(_name: 'application-menu-clicked', handler: (event: unknown) => void): void {
    this.clickHandler = handler;
  }
}

/**
 * Finds an item by label anywhere in a menu configuration.
 *
 * @param items Items to search.
 * @param label Item label.
 * @returns Matching item, or undefined.
 */
function nativeMenuHostTestFind(
  items: readonly NativeMenuApplicationConfigItem[],
  label: string,
): NativeMenuApplicationConfigItem | undefined {
  for (const item of items) {
    if ('label' in item && item.label === label) {
      return item;
    }
    const nested = 'submenu' in item && item.submenu ? nativeMenuHostTestFind(item.submenu, label) : undefined;
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

describe('NativeMenuHost', () => {
  it('puts the app menu first with the page settings row and Quit, then the page menus', () => {
    const bar = NativeMenuSerializer.serialize(new NativeMenuTestMenus().sourcesCreate()).bar;
    const config = nativeMenuApplicationConfigBuild(bar, 'Broom');
    const labels = config.map((item) => ('label' in item ? item.label : ''));
    expect(labels).toEqual(['Broom', 'File', 'Edit', 'Window']);
    const appMenu = config[0];
    const appRows = appMenu && 'submenu' in appMenu ? (appMenu.submenu ?? []) : [];
    expect(nativeMenuHostTestFind(appRows, 'Settings')).toBeDefined();
    expect(appRows.some((item) => 'role' in item && item.role === 'quit')).toBe(true);
  });

  it('forwards clicks on page rows to the page and ignores system rows', () => {
    const menus = new NativeMenuTestMenus();
    const serialization = NativeMenuSerializer.serialize(menus.sourcesCreate());
    const applicationMenu = new NativeMenuHostTestApplicationMenu();
    const actionRunner = vi.fn((actionId: string) => serialization.actions.get(actionId)?.onClick());
    const host = new NativeMenuHost(applicationMenu, 'Broom', actionRunner);
    host.menuBarSet(serialization.bar);
    const plain = nativeMenuHostTestFind(applicationMenu.installedMenu, 'Plain');
    const action = plain && 'action' in plain ? plain.action : '';
    applicationMenu.clickHandler?.({ data: { action } });
    applicationMenu.clickHandler?.({ data: { action: 'quit' } });
    expect(actionRunner).toHaveBeenCalledTimes(1);
    expect(menus.plainAction).toHaveBeenCalledTimes(1);
  });
});
