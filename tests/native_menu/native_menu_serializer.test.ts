import { describe, expect, it } from 'vitest';
import { NativeMenuSerializer, nativeMenuSeparatorsTidy } from '@/native_menu/native_menu_serializer.js';
import type { NativeMenuItemWire, NativeMenuWire } from '@/native_menu/native_menu_types.js';
import { NativeMenuTestMenus } from './native_menu_test_support.js';

/**
 * Finds a row by label anywhere in a menu.
 *
 * @param items Rows to search.
 * @param label Row label.
 * @returns Matching row, or undefined.
 */
function nativeMenuTestItemFind(items: readonly NativeMenuItemWire[], label: string): NativeMenuItemWire | undefined {
  for (const item of items) {
    if (item.kind !== 'separator' && item.label === label) {
      return item;
    }
    const nested = item.kind === 'submenu' ? nativeMenuTestItemFind(item.items, label) : undefined;
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

/**
 * Returns the menu with a label.
 *
 * @param menus Menus to search.
 * @param label Menu label.
 * @returns Matching menu.
 */
function nativeMenuTestMenuRead(menus: readonly NativeMenuWire[], label: string): NativeMenuWire {
  const menu = menus.find((candidate) => candidate.label === label);
  if (!menu) {
    throw new Error(`missing menu ${label}`);
  }
  return menu;
}

describe('NativeMenuSerializer', () => {
  it('keeps every page menu in order and maps each action row id to its page action', () => {
    const menus = new NativeMenuTestMenus();
    const serialization = NativeMenuSerializer.serialize(menus.sourcesCreate());
    expect(serialization.bar.menus.map((menu) => menu.label)).toEqual(['File', 'Edit']);
    const plain = nativeMenuTestItemFind(serialization.bar.menus[0]?.items ?? [], 'Plain');
    expect(plain?.kind).toBe('action');
    const actionId = plain?.kind === 'action' ? plain.actionId : '';
    serialization.actions.get(actionId)?.onClick();
    expect(menus.plainAction).toHaveBeenCalledTimes(1);
  });

  it('snapshots live check marks, enablement and resolved submenu children', () => {
    const menus = new NativeMenuTestMenus();
    menus.isToggleChecked = true;
    menus.isGuardEnabled = false;
    const bar = NativeMenuSerializer.serialize(menus.sourcesCreate()).bar;
    const toggle = nativeMenuTestItemFind(nativeMenuTestMenuRead(bar.menus, 'File').items, 'Toggle');
    const guarded = nativeMenuTestItemFind(nativeMenuTestMenuRead(bar.menus, 'Edit').items, 'Guarded');
    expect(toggle?.kind === 'action' && toggle.checked).toBe(true);
    expect(guarded?.kind === 'action' && guarded.enabled).toBe(false);
  });

  it('moves settings rows into the application menu and clipboard rows to system roles', () => {
    const bar = NativeMenuSerializer.serialize(new NativeMenuTestMenus().sourcesCreate()).bar;
    expect(nativeMenuTestItemFind(nativeMenuTestMenuRead(bar.menus, 'File').items, 'Settings')).toBeUndefined();
    expect(bar.applicationItems.map((entry) => entry.slot)).toEqual(['settings']);
    expect(bar.applicationItems[0]?.item.accelerator).toBe('command+,');
    const copy = nativeMenuTestItemFind(nativeMenuTestMenuRead(bar.menus, 'Edit').items, 'Copy');
    expect(copy).toMatchObject({ kind: 'role', role: 'copy', accelerator: 'command+c' });
    const undo = nativeMenuTestItemFind(nativeMenuTestMenuRead(bar.menus, 'Edit').items, 'Undo');
    expect(undo).toMatchObject({ kind: 'action', accelerator: 'command+z' });
  });

  it('never leaves leading, trailing or doubled separators', () => {
    const bar = NativeMenuSerializer.serialize(new NativeMenuTestMenus().sourcesCreate()).bar;
    for (const menu of bar.menus) {
      expect(nativeMenuSeparatorsTidy(menu.items)).toEqual(menu.items);
      expect(menu.items[0]?.kind).not.toBe('separator');
      expect(menu.items[menu.items.length - 1]?.kind).not.toBe('separator');
    }
  });
});
