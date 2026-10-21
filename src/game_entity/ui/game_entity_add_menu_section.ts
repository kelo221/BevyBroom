import type * as THREE from 'three';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityOwner, gameEntityCreateForClass } from '@/game_entity/owner/game_entity_owner.js';
import type { AddMenuActions } from '@/layout/setup/add_menu_entries.js';
import { addMenuCatalogActionCreate } from '@/layout/setup/add_menu_catalog.js';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { GameEntityVisualBuilder } from '@/game_entity/visual/game_entity_visual_builder.js';
import type { IconName } from '@/ui/icons/icon_name.js';
import { hexToRgb } from '@/utils/utils_color.js';

/** Icon of game entity rows; the same icon game entities show everywhere. */
const GAME_ENTITY_MENU_ICON: IconName = GameEntityOwner.definition.iconName({});

/** Approximate half-extent of a new game entity, used for wall clearance. */
const GAME_ENTITY_PLACEMENT_RADIUS = 0.3;

/** Catalog id prefix of entries that place a game entity carrying one class. */
export const GAME_ENTITY_ADD_MENU_CLASS_ID_PREFIX = 'game_entity.class.';

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
    icon: GAME_ENTITY_MENU_ICON,
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
  const categories = gameEntityAddMenuCategories(GameEntityClassRegistry.classesList());
  const categoryEntries = [...categories].map(([category, classes]): ToolbarMenuEntry => ({
    kind: 'submenu',
    label: category,
    children: classes.map((gameClass) => gameEntityAddMenuClassEntry(actions, gameClass)),
  }));
  return [gameEntityAddMenuEmptyEntry(actions), { kind: 'separator' }, ...categoryEntries];
}

/**
 * Builds the entry that places a game entity without components.
 *
 * @param actions Creation callbacks.
 * @returns Menu action with catalog information.
 */
function gameEntityAddMenuEmptyEntry(actions: AddMenuActions): ToolbarMenuEntry {
  return addMenuCatalogActionCreate(
    {
      label: 'Empty Game Entity',
      icon: 'crosshairs',
      onClick: () =>
        actions.onAddEntityPlaced(() => GameEntityOwner.createDefault('Game Entity'), GAME_ENTITY_PLACEMENT_RADIUS),
    },
    { id: 'game_entity.empty', objectMatches: gameEntityAddMenuEmptyMatches },
  );
}

/**
 * Returns whether an object is a game entity without any component.
 *
 * @param object Candidate scene object.
 * @returns True for empty game entities.
 */
function gameEntityAddMenuEmptyMatches(object: THREE.Object3D): boolean {
  return GameEntityOwner.isOwner(object) && !GameEntityComponentStore.hasAny(object);
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
 * Builds the entry that places a game entity carrying one class. Any object
 * carrying the class counts as an instance of the entry.
 *
 * @param actions Creation callbacks.
 * @param gameClass Component class.
 * @returns Menu action with catalog information.
 */
function gameEntityAddMenuClassEntry(actions: AddMenuActions, gameClass: GameEntityClass): ToolbarMenuEntry {
  return addMenuCatalogActionCreate(
    {
      label: gameClass.label,
      icon: GAME_ENTITY_MENU_ICON,
      iconColor: hexToRgb(GameEntityVisualBuilder.classColorOf(gameClass)),
      tooltip: gameClass.type_path,
      onClick: () => actions.onAddEntityPlaced(() => gameEntityCreateForClass(gameClass), GAME_ENTITY_PLACEMENT_RADIUS),
    },
    {
      id: `${GAME_ENTITY_ADD_MENU_CLASS_ID_PREFIX}${gameClass.type_path}`,
      objectMatches: (object) => Object.hasOwn(GameEntityComponentStore.read(object), gameClass.type_path),
    },
  );
}
