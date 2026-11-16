import { describe, expect, it, vi } from 'vitest';
import { CommandSearchCatalog } from '@/ui/command_search/command_search_catalog.js';
import { commandSearchTestSourceCreate } from './command_search_test_support.js';

/**
 * Proves the command search collects every action row of the menus, including
 * rows in nested and live submenus, with their menu path, shortcut, enablement
 * and action.
 */
describe('CommandSearchCatalog', () => {
  it('collects action rows of every menu and nested submenu with their paths', () => {
    const items = CommandSearchCatalog.itemsCollect([
      commandSearchTestSourceCreate('File', [{ label: 'Save', onClick: vi.fn() }, { kind: 'separator' }]),
      commandSearchTestSourceCreate('Edit', [
        {
          kind: 'submenu',
          label: 'CSG',
          children: [{ kind: 'submenu', label: 'Inner', children: [{ label: 'Deep', onClick: vi.fn() }] }],
        },
        {
          kind: 'submenu',
          label: 'Live',
          children: [],
          childrenResolve: () => [{ label: 'Resolved', onClick: vi.fn() }],
        },
      ]),
    ]);
    expect(items.map((item) => [...item.path, item.label].join(' > '))).toEqual([
      'File > Save',
      'Edit > CSG > Inner > Deep',
      'Edit > Live > Resolved',
    ]);
    expect(new Set(items.map((item) => item.key)).size).toBe(items.length);
  });

  it('keeps the shortcut text, live enablement and action of each row', () => {
    let isEnabled = false;
    const onClick = vi.fn();
    const [item] = CommandSearchCatalog.itemsCollect([
      commandSearchTestSourceCreate('Edit', [
        { label: 'Hollow', onClick, shortcut: () => ' Ctrl+Shift+O ', isEnabled: () => isEnabled },
      ]),
    ]);
    if (!item) {
      throw new Error('No command collected');
    }
    expect(item.shortcut).toBe('Ctrl+Shift+O');
    expect(item.isEnabled()).toBe(false);
    isEnabled = true;
    expect(item.isEnabled()).toBe(true);
    item.run();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
