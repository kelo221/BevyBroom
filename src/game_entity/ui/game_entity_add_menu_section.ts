import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityOwner, gameEntityCreateForClass } from '@/game_entity/owner/game_entity_owner.js';
import type { AddMenuActions } from '@/layout/setup/add_menu_entries.js';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';

/** Approximate half-extent of a new game entity, used for wall clearance. */
const GAME_ENTITY_PLACEMENT_RADIUS = 0.3;

/**
 * Builds the Game Entities submenu: an empty game entity, then one submenu per
 * class category. The entries follow the classes known when the menu opens.
 *
 * @param actions Creation callbacks.
 * @returns Game Entities submenu.
 */
export function gameEntityAddMenuSection(actions: AddMenuActions): ToolbarMenuEntry {
  return {
    kind: 'submenu',
    label: 'Game Entities',
    children: [],
    childrenResolve: () => gameEntityAddMenuEntries(actions),
  };
}

/**
 * Returns the current entries of the Game Entities submenu.
 *
 * @param actions Creation callbacks.
 * @returns Menu entries.
 */
export function gameEntityAddMenuEntries(actions: AddMenuActions): ToolbarMenuEntry[] {
  const empty: ToolbarMenuEntry = {
    label: 'Empty Game Entity',
    onClick: () =>
      actions.onAddEntityPlaced(() => GameEntityOwner.createDefault('Game Entity'), GAME_ENTITY_PLACEMENT_RADIUS),
  };
  const categories = gameEntityAddMenuCategories(GameEntityClassRegistry.classesList());
  const categoryEntries = [...categories].map(([category, classes]): ToolbarMenuEntry => ({
    kind: 'submenu',
    label: category,
    children: classes.map((gameClass) => gameEntityAddMenuClassEntry(actions, gameClass)),
  }));
  return [empty, { kind: 'separator' }, ...categoryEntries];
}

/**
 * Groups classes by category, keeping their order.
 *
 * @param classes Classes sorted by category and label.
 * @returns Classes by category.
 */
function gameEntityAddMenuCategories(classes: readonly GameEntityClass[]): Map<string, GameEntityClass[]> {
  const categories = new Map<string, GameEntityClass[]>();
  for (const gameClass of classes) {
    const members = categories.get(gameClass.category) ?? [];
    members.push(gameClass);
    categories.set(gameClass.category, members);
  }
  return categories;
}

/**
 * Builds the entry that places a game entity carrying one class.
 *
 * @param actions Creation callbacks.
 * @param gameClass Component class.
 * @returns Menu action.
 */
function gameEntityAddMenuClassEntry(actions: AddMenuActions, gameClass: GameEntityClass): ToolbarMenuEntry {
  return {
    label: gameClass.label,
    tooltip: gameClass.type_path,
    onClick: () => actions.onAddEntityPlaced(() => gameEntityCreateForClass(gameClass), GAME_ENTITY_PLACEMENT_RADIUS),
  };
}
