import { describe, expect, it, vi } from 'vitest';
import { createAddMenuEntries, type AddMenuActions } from '@/layout/setup/add_menu_entries.js';
import { isMenuAction, isMenuSubmenu, type ToolbarMenuEntry } from '@/ui/menu/menu_types.js';

/**
 * Returns the child entries of a submenu and fails for any other entry type.
 *
 * @param entry Menu entry expected to contain children.
 * @returns Children belonging to the submenu entry.
 */
function getSubmenuChildren(entry: ToolbarMenuEntry): ToolbarMenuEntry[] {
  expect(isMenuSubmenu(entry)).toBe(true);
  return isMenuSubmenu(entry) ? entry.children : [];
}

/**
 * Collects visible labels from actions and submenus (separators have none).
 *
 * @param entries Menu entries to read.
 * @returns Labels in menu order.
 */
function getEntryLabels(entries: ToolbarMenuEntry[]): string[] {
  const labels: string[] = [];
  for (const entry of entries) {
    if (isMenuAction(entry) || isMenuSubmenu(entry)) {
      labels.push(entry.label);
    }
  }
  return labels;
}

/** Number of categories every Add menu starts with. */
const BUILTIN_CATEGORY_COUNT = 6;

describe('createAddMenuEntries', () => {
  it('groups every creation action into the expected category', () => {
    const actions = createActionSpies();
    const entries = createAddMenuEntries(actions);
    expect(getEntryLabels(entries).slice(0, BUILTIN_CATEGORY_COUNT)).toEqual([
      'Geometry',
      'Terrain',
      'Brushes',
      'Lights',
      'Portals',
      'Game Entities',
    ]);
    expect(getEntryLabels(getSubmenuChildren(entries[0]!))).toEqual(['Cube', 'Sphere', 'Cylinder', 'Plane']);
    expect(getEntryLabels(getSubmenuChildren(entries[1]!))).toEqual(['Terrain']);
    expect(getEntryLabels(getSubmenuChildren(entries[2]!))).toEqual(['Solid Model', 'Bevel Volume']);
    expect(getEntryLabels(getSubmenuChildren(entries[3]!))).toEqual(['Point Light', 'Spot Light']);
    expect(getEntryLabels(getSubmenuChildren(entries[4]!))).toEqual(['Room', 'Portal']);
  });

  it('routes every built-in category item to its own creation callback', () => {
    const actions = createActionSpies();
    const entries = createAddMenuEntries(actions).slice(0, BUILTIN_CATEGORY_COUNT);
    entries.flatMap(getSubmenuChildren).forEach((entry) => {
      expect(isMenuAction(entry)).toBe(true);
      if (isMenuAction(entry)) entry.onClick();
    });
    Object.entries(actions)
      .filter(([name]) => name !== 'onAddEntityPlaced')
      .forEach(([, callback]) => expect(callback).toHaveBeenCalledTimes(1));
  });
});

/**
 * Creates isolated spies for every Add menu creation callback.
 *
 * @returns Complete Add menu callback collection.
 */
function createActionSpies(): AddMenuActions {
  return {
    onAddCube: vi.fn(),
    onAddSphere: vi.fn(),
    onAddCylinder: vi.fn(),
    onAddPlane: vi.fn(),
    onAddTerrain: vi.fn(),
    onAddSolidModel: vi.fn(),
    onAddBevelVolume: vi.fn(),
    onAddPointLight: vi.fn(),
    onAddSpotLight: vi.fn(),
    onAddRoom: vi.fn(),
    onAddPortal: vi.fn(),
    onAddEntityPlaced: vi.fn(),
  };
}
