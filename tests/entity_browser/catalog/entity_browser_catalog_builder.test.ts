import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ENTITY_BROWSER_CATALOG_CATEGORY_SEPARATOR,
  EntityBrowserCatalogBuilder,
} from '@/entity_browser/catalog/entity_browser_catalog_builder.js';
import { GAME_ENTITY_ADD_MENU_CLASS_ID_PREFIX } from '@/game_entity/ui/game_entity_add_menu_section.js';
import { addMenuCatalogActionCreate } from '@/layout/setup/add_menu_catalog.js';
import { createAddMenuEntries } from '@/layout/setup/add_menu_entries.js';
import { AddMenuSectionRegistry, type AddMenuSectionFactory } from '@/layout/setup/add_menu_section_registry.js';
import { isMenuAction, isMenuSubmenu, type ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { testClassesInstall, testDoorClassCreate } from '../../game_entity/game_entity_test_classes.js';
import { entityBrowserTestActionSpiesCreate } from '../entity_browser_test_support.js';

/**
 * Counts the actions of a menu tree, resolving live submenus.
 *
 * @param entries Menu entries.
 * @returns Number of action rows.
 */
function menuActionCount(entries: readonly ToolbarMenuEntry[]): number {
  return entries.reduce((count, entry) => {
    if (isMenuSubmenu(entry)) {
      return count + menuActionCount(entry.childrenResolve?.() ?? entry.children);
    }
    return count + (isMenuAction(entry) ? 1 : 0);
  }, 0);
}

/**
 * Creates an Add menu section with a plain action and a nested tagged action.
 *
 * @param taggedClick Callback of the tagged action.
 * @returns Section factory.
 */
function customSectionCreate(taggedClick: () => void): AddMenuSectionFactory {
  const tagged = addMenuCatalogActionCreate({ label: 'Tagged', onClick: taggedClick }, { id: 'custom.tagged' });
  return () => ({
    kind: 'submenu',
    label: 'Custom Kinds',
    children: [
      { label: 'Plain Thing', onClick: vi.fn() },
      { kind: 'submenu', label: 'Nested', children: [tagged] },
    ],
  });
}

/**
 * The catalog lists every action of the Add menu section registry, so new kinds
 * appear in the entity browser without touching it.
 */
describe('EntityBrowserCatalogBuilder', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('lists every Add menu action once with a unique id and its section as category', () => {
    const actions = entityBrowserTestActionSpiesCreate();
    const catalog = EntityBrowserCatalogBuilder.catalogBuild(actions);
    expect(catalog).toHaveLength(menuActionCount(createAddMenuEntries(actions)));
    expect(new Set(catalog.map((entry) => entry.id)).size).toBe(catalog.length);
    const pointLight = catalog.find((entry) => entry.id === 'lights.point');
    expect(pointLight?.category).toBe('Lights');
    expect(pointLight?.iconName).not.toBeNull();
    expect(catalog.map((entry) => entry.catalogIndex)).toEqual(catalog.map((_entry, index) => index));
  });

  it('runs the same action as the Add menu when an entry is activated', () => {
    const actions = entityBrowserTestActionSpiesCreate();
    const catalog = EntityBrowserCatalogBuilder.catalogBuild(actions);
    catalog.find((entry) => entry.id === 'lights.spot')?.activate();
    catalog.find((entry) => entry.id === 'portals.room')?.activate();
    expect(actions.onAddSpotLight).toHaveBeenCalledTimes(1);
    expect(actions.onAddRoom).toHaveBeenCalledTimes(1);
    expect(actions.onAddPointLight).not.toHaveBeenCalled();
  });

  it('includes a registered section, deriving ids for actions without catalog information', () => {
    const taggedClick = vi.fn();
    const section = customSectionCreate(taggedClick);
    AddMenuSectionRegistry.register(section);
    cleanups.push(() => AddMenuSectionRegistry.unregister(section));
    const catalog = EntityBrowserCatalogBuilder.catalogBuild(entityBrowserTestActionSpiesCreate());
    const plain = catalog.find((entry) => entry.label === 'Plain Thing');
    const tagged = catalog.find((entry) => entry.id === 'custom.tagged');
    expect(plain?.id).toBe('menu.custom_kinds.plain_thing');
    expect(plain?.category).toBe('Custom Kinds');
    expect(tagged?.category).toBe(['Custom Kinds', 'Nested'].join(ENTITY_BROWSER_CATALOG_CATEGORY_SEPARATOR));
    tagged?.activate();
    expect(taggedClick).toHaveBeenCalledTimes(1);
  });

  it('follows the game classes known when the catalog is built', () => {
    const door = testDoorClassCreate();
    const doorId = `${GAME_ENTITY_ADD_MENU_CLASS_ID_PREFIX}${door.type_path}`;
    const before = EntityBrowserCatalogBuilder.catalogBuild(entityBrowserTestActionSpiesCreate());
    const { uninstall } = testClassesInstall();
    cleanups.push(uninstall);
    const after = EntityBrowserCatalogBuilder.catalogBuild(entityBrowserTestActionSpiesCreate());
    expect(before.some((entry) => entry.id === doorId)).toBe(false);
    const doorEntry = after.find((entry) => entry.id === doorId);
    expect(doorEntry?.label).toBe(door.label);
    expect(doorEntry?.category).toBe(['Game Entities', door.category].join(ENTITY_BROWSER_CATALOG_CATEGORY_SEPARATOR));
  });

  it('skips actions whose live enablement check says they are disabled', () => {
    const click = vi.fn();
    const section: AddMenuSectionFactory = () => ({
      kind: 'submenu',
      label: 'Locked Kinds',
      children: [{ label: 'Locked', onClick: click, isEnabled: () => false }],
    });
    AddMenuSectionRegistry.register(section);
    cleanups.push(() => AddMenuSectionRegistry.unregister(section));
    const catalog = EntityBrowserCatalogBuilder.catalogBuild(entityBrowserTestActionSpiesCreate());
    catalog.find((entry) => entry.label === 'Locked')?.activate();
    expect(click).not.toHaveBeenCalled();
  });
});
