import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAddMenuEntries, type AddMenuActions } from '@/layout/setup/add_menu_entries.js';
import { AddMenuSectionRegistry, type AddMenuSectionFactory } from '@/layout/setup/add_menu_section_registry.js';
import { isMenuAction, isMenuSubmenu, type ToolbarMenuEntry } from '@/ui/menu/menu_types.js';

/**
 * Creates spy callbacks for every Add menu action.
 *
 * @returns Action spies.
 */
function actionSpies(): AddMenuActions {
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

/**
 * Returns the label of a menu entry.
 *
 * @param entry Menu entry.
 * @returns Label, or empty for separators.
 */
function entryLabel(entry: ToolbarMenuEntry): string {
  return isMenuSubmenu(entry) || isMenuAction(entry) ? entry.label : '';
}

/** Features add their own Add menu sections after the built-in categories. */
describe('AddMenuSectionRegistry', () => {
  const testSection: AddMenuSectionFactory = (actions) => ({
    kind: 'submenu',
    label: 'Test Things',
    children: [{ label: 'Thing', onClick: () => actions.onAddCube() }],
  });

  afterEach(() => {
    AddMenuSectionRegistry.unregister(testSection);
  });

  it('appends a registered section after the built-in categories and wires its actions', () => {
    const builtinCount = createAddMenuEntries(actionSpies()).length;
    AddMenuSectionRegistry.register(testSection);
    const actions = actionSpies();
    const entries = createAddMenuEntries(actions);
    expect(entries).toHaveLength(builtinCount + 1);
    const added = entries[entries.length - 1];
    expect(added ? entryLabel(added) : '').toBe('Test Things');
    const child = added && isMenuSubmenu(added) ? added.children[0] : undefined;
    if (child && isMenuAction(child)) child.onClick();
    expect(actions.onAddCube).toHaveBeenCalledTimes(1);
  });

  it('drops a section once it is unregistered', () => {
    AddMenuSectionRegistry.register(testSection);
    AddMenuSectionRegistry.unregister(testSection);
    expect(createAddMenuEntries(actionSpies()).map(entryLabel)).not.toContain('Test Things');
  });
});
