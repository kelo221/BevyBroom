import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { addMenuCatalogActionCreate, addMenuCatalogInfoRead } from '@/layout/setup/add_menu_catalog.js';
import { createAddMenuEntries } from '@/layout/setup/add_menu_entries.js';
import { isMenuAction, isMenuSubmenu, type ToolbarMenuAction, type ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { ToolPrimitiveCreation } from '@/tools/creation/tool_primitive_creation.js';
import { entityBrowserTestActionSpiesCreate } from '../../entity_browser/entity_browser_test_support.js';
import { modifierVolumeTemplateCreate } from '@/modifier/stack/modifier_volume_templates.js';

/**
 * Collects the actions of a menu tree, resolving live submenus.
 *
 * @param entries Menu entries.
 * @returns Action rows.
 */
function menuActionsCollect(entries: readonly ToolbarMenuEntry[]): ToolbarMenuAction[] {
  return entries.flatMap((entry): ToolbarMenuAction[] => {
    if (isMenuSubmenu(entry)) {
      return menuActionsCollect(entry.childrenResolve?.() ?? entry.children);
    }
    return isMenuAction(entry) ? [entry] : [];
  });
}

/**
 * Returns the object matcher of the built-in Add menu action with an id.
 *
 * @param catalogId Catalog id.
 * @returns Object matcher.
 */
function builtinMatcher(catalogId: string): (object: THREE.Object3D) => boolean {
  const actions = menuActionsCollect(createAddMenuEntries(entityBrowserTestActionSpiesCreate()));
  const matcher = actions.map(addMenuCatalogInfoRead).find((info) => info?.id === catalogId)?.objectMatches;
  if (!matcher) throw new Error(`no matcher for ${catalogId}`);
  return matcher;
}

/** Add menu actions carry stable ids and object matchers for catalogs. */
describe('add menu catalog information', () => {
  it('is read from tagged actions and absent on plain actions', () => {
    const onClick = vi.fn();
    const tagged = addMenuCatalogActionCreate({ label: 'Thing', onClick }, { id: 'test.thing' });
    expect(addMenuCatalogInfoRead(tagged)?.id).toBe('test.thing');
    expect(addMenuCatalogInfoRead({ label: 'Plain', onClick })).toBeNull();
    tagged.onClick();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('gives every built-in action a unique id', () => {
    const actions = menuActionsCollect(createAddMenuEntries(entityBrowserTestActionSpiesCreate()));
    const ids = actions.map((action) => addMenuCatalogInfoRead(action)?.id);
    expect(ids.every((id) => typeof id === 'string')).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('recognizes objects built by the editor factories with the matching kind only', () => {
    const tool = new ToolPrimitiveCreation(new THREE.Group());
    const cube = tool.createBox(1, 1, 1);
    const pointLight = LightOwner.createDefault('Point', 'point');
    const volume = modifierVolumeTemplateCreate('bevel');
    expect(builtinMatcher('geometry.box')(cube)).toBe(true);
    expect(builtinMatcher('geometry.sphere')(cube)).toBe(false);
    expect(builtinMatcher('lights.point')(pointLight)).toBe(true);
    expect(builtinMatcher('lights.spot')(pointLight)).toBe(false);
    expect(builtinMatcher('modifiers.bevel')(volume)).toBe(true);
    expect(builtinMatcher('modifiers.linear')(volume)).toBe(false);
    expect(builtinMatcher('modifiers.linear')(modifierVolumeTemplateCreate('linear'))).toBe(true);
    expect(builtinMatcher('geometry.box')(volume)).toBe(false);
  });
});
