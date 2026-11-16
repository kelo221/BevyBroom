import { describe, expect, it, vi } from 'vitest';
import { menuEntriesAvailableFilter } from '@/ui/menu/menu_entries_available.js';
import { isMenuSubmenu, type ToolbarMenuEntry } from '@/ui/menu/menu_types.js';

/**
 * Builds an action row.
 *
 * @param label Row label.
 * @param isEnabled Enablement the row reports; omitted rows are always enabled.
 * @returns Action entry.
 */
function menuEntriesAvailableTestAction(label: string, isEnabled?: boolean): ToolbarMenuEntry {
  return {
    label,
    onClick: vi.fn(),
    ...(isEnabled === undefined ? {} : { isEnabled: () => isEnabled }),
  };
}

/**
 * Describes filtered entries as labels, with `-` for separators and `Label>`
 * for submenus.
 *
 * @param entries Filtered entries.
 * @returns Readable shape of the entries.
 */
function menuEntriesAvailableTestShape(entries: readonly ToolbarMenuEntry[]): string[] {
  return entries.map((entry) => {
    if (entry.kind === 'separator') {
      return '-';
    }
    return isMenuSubmenu(entry) ? `${entry.label}>` : entry.label;
  });
}

/**
 * Proves the context menu filter shows only rows that apply: disabled actions
 * and empty or disabled submenus disappear, separators stay only between shown
 * groups, and submenu children are fixed at filter time.
 */
describe('menuEntriesAvailableFilter', () => {
  it('drops disabled actions and keeps enabled and unconditional ones', () => {
    const entries = [
      menuEntriesAvailableTestAction('Enabled', true),
      menuEntriesAvailableTestAction('Disabled', false),
      menuEntriesAvailableTestAction('Always'),
    ];
    expect(menuEntriesAvailableTestShape(menuEntriesAvailableFilter(entries))).toEqual(['Enabled', 'Always']);
  });

  it('leaves separators only between shown groups', () => {
    const separator: ToolbarMenuEntry = { kind: 'separator' };
    const entries = [
      separator,
      menuEntriesAvailableTestAction('First'),
      separator,
      menuEntriesAvailableTestAction('Hidden', false),
      separator,
      menuEntriesAvailableTestAction('Second'),
      separator,
    ];
    expect(menuEntriesAvailableTestShape(menuEntriesAvailableFilter(entries))).toEqual(['First', '-', 'Second']);
  });

  it('drops submenus that are disabled or keep no shown child, and fixes the shown children', () => {
    const childrenResolve = vi.fn(() => [
      menuEntriesAvailableTestAction('Shown child'),
      menuEntriesAvailableTestAction('Hidden child', false),
    ]);
    const entries: ToolbarMenuEntry[] = [
      { kind: 'submenu', label: 'Live', children: [], childrenResolve },
      { kind: 'submenu', label: 'Empty', children: [menuEntriesAvailableTestAction('Hidden', false)] },
      { kind: 'submenu', label: 'Disabled', children: [menuEntriesAvailableTestAction('Any')], isEnabled: () => false },
    ];
    const filtered = menuEntriesAvailableFilter(entries);
    expect(menuEntriesAvailableTestShape(filtered)).toEqual(['Live>']);
    const live = filtered[0];
    if (!live || !isMenuSubmenu(live)) {
      throw new Error('Live submenu missing');
    }
    expect(live.childrenResolve).toBeUndefined();
    expect(menuEntriesAvailableTestShape(live.children)).toEqual(['Shown child']);
    expect(childrenResolve).toHaveBeenCalledTimes(1);
  });
});
