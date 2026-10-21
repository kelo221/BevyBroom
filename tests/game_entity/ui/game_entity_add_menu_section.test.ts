import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { gameEntityAddMenuEntries, gameEntityAddMenuSection } from '@/game_entity/ui/game_entity_add_menu_section.js';
import type { AddMenuActions } from '@/layout/setup/add_menu_entries.js';
import { isMenuAction, isMenuSubmenu, type ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { TEST_DOOR_TYPE_PATH, testClassesInstall, testDoorClassCreate } from '../game_entity_test_classes.js';

/**
 * Creates Add menu callbacks that record placed entities.
 *
 * @returns Callbacks and the entities they placed.
 */
function actionsCreate(): { actions: AddMenuActions; placed: THREE.Group[] } {
  const placed: THREE.Group[] = [];
  const onAddEntityPlaced = vi.fn((factory: () => THREE.Group) => placed.push(factory()));
  const actions = { onAddEntityPlaced } as unknown as AddMenuActions;
  return { actions, placed };
}

/**
 * Finds a submenu by label.
 *
 * @param entries Menu entries.
 * @param label Submenu label.
 * @returns The submenu's children.
 */
function submenuChildren(entries: readonly ToolbarMenuEntry[], label: string): ToolbarMenuEntry[] {
  const submenu = entries.find((entry) => isMenuSubmenu(entry) && entry.label === label);
  return submenu && isMenuSubmenu(submenu) ? submenu.children : [];
}

/**
 * The Game Entities submenu offers an empty game entity and one entry per known
 * class, grouped by category, and follows class changes.
 */
describe('gameEntityAddMenuSection', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('resolves its entries when the menu opens', () => {
    const { actions } = actionsCreate();
    const section = gameEntityAddMenuSection(actions);
    expect(isMenuSubmenu(section) && section.childrenResolve).toBeTruthy();
    const before = isMenuSubmenu(section) ? (section.childrenResolve?.() ?? []) : [];
    const { uninstall } = testClassesInstall();
    cleanups.push(uninstall);
    const after = isMenuSubmenu(section) ? (section.childrenResolve?.() ?? []) : [];
    expect(submenuChildren(before, testDoorClassCreate().category)).toHaveLength(0);
    expect(submenuChildren(after, testDoorClassCreate().category)).toHaveLength(1);
  });

  it('places a game entity carrying the chosen class', () => {
    const { uninstall } = testClassesInstall();
    cleanups.push(uninstall);
    const { actions, placed } = actionsCreate();
    const door = testDoorClassCreate();
    const [entry] = submenuChildren(gameEntityAddMenuEntries(actions), door.category);
    expect(entry && isMenuAction(entry) ? entry.label : '').toBe(door.label);
    if (entry && isMenuAction(entry)) entry.onClick();
    expect(placed).toHaveLength(1);
    const [owner] = placed;
    expect(owner && GameEntityOwner.isOwner(owner)).toBe(true);
    expect(owner && GameEntityComponentStore.read(owner)).toEqual({ [TEST_DOOR_TYPE_PATH]: {} });
  });

  it('always offers an empty game entity first', () => {
    const { actions, placed } = actionsCreate();
    const [first] = gameEntityAddMenuEntries(actions);
    if (first && isMenuAction(first)) first.onClick();
    expect(placed[0] && GameEntityOwner.isOwner(placed[0])).toBe(true);
    expect(placed[0] && GameEntityComponentStore.hasAny(placed[0])).toBe(false);
  });
});
