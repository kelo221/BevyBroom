import type * as THREE from 'three';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { gameEntityClassIdOf } from '@/game_entity/class/game_entity_class_id.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityOwner, gameEntityCreateForClass } from '@/game_entity/owner/game_entity_owner.js';
import type { AddMenuActions } from '@/layout/setup/add_menu_entries.js';
import { addMenuCatalogActionCreate } from '@/layout/setup/add_menu_catalog.js';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { GameEntityVisualBuilder } from '@/game_entity/visual/game_entity_visual_builder.js';
import type { IconName } from '@/ui/icons/icon_name.js';
import { hexToRgb } from '@/utils/utils_color.js';
import {
  gameEntityAddMenuVariantsOf,
  type GameEntityAddMenuVariant,
} from '@/game_entity/ui/game_entity_add_menu_variants.js';
import { GameEntityVisualMarkerBox } from '@/game_entity/visual/game_entity_visual_marker_box.js';

/** Icon of game entity rows; the same icon game entities show everywhere. */
const GAME_ENTITY_MENU_ICON: IconName = GameEntityOwner.definition.iconName({});

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
    children: gameEntityAddMenuCategoryChildren(actions, classes),
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
    {
      id: 'game_entity.empty',
      objectMatches: gameEntityAddMenuEmptyMatches,
      previewCreate: () => GameEntityOwner.createDefault('Game Entity'),
    },
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
 * Builds the entries of one category: one entry per class that offers no choice
 * of kinds, then one submenu per group of the kinds the other classes offer,
 * such as "Fridges & freezers" holding the freezer and the big fridge. Groups
 * and the kinds in them are in name order.
 *
 * @param actions Creation callbacks.
 * @param classes Classes of the category.
 * @returns Category entries.
 */
function gameEntityAddMenuCategoryChildren(
  actions: AddMenuActions,
  classes: readonly GameEntityClass[],
): ToolbarMenuEntry[] {
  const classEntries = classes
    .filter((gameClass) => gameEntityAddMenuVariantsOf(gameClass).length === 0)
    .map((gameClass) => gameEntityAddMenuClassEntry(actions, gameClass));
  const groups = gameEntityAddMenuVariantGroups(classes.flatMap((gameClass) => gameEntityAddMenuVariantsOf(gameClass)));
  const groupEntries = [...groups].map(([group, variants]): ToolbarMenuEntry => ({
    kind: 'submenu',
    label: group,
    icon: GAME_ENTITY_MENU_ICON,
    children: variants.map((variant) => gameEntityAddMenuVariantEntry(actions, variant.gameClass, variant)),
  }));
  return [...classEntries, ...groupEntries];
}

/**
 * Sorts kinds into their groups, groups and kinds in name order.
 *
 * @param variants Kinds of one category.
 * @returns Kinds by group.
 */
function gameEntityAddMenuVariantGroups(
  variants: readonly GameEntityAddMenuVariant[],
): Map<string, GameEntityAddMenuVariant[]> {
  const sorted = [...variants].sort(
    (first, second) => first.group.localeCompare(second.group) || first.label.localeCompare(second.label),
  );
  const groups = new Map<string, GameEntityAddMenuVariant[]>();
  for (const variant of sorted) {
    groups.set(variant.group, [...(groups.get(variant.group) ?? []), variant]);
  }
  return groups;
}

/**
 * Builds the entry that places a game entity carrying a class whose marker box
 * field holds one value. Objects carrying the class with that value count as
 * instances of the entry.
 *
 * @param actions Creation callbacks.
 * @param gameClass Component class.
 * @param variant Field value and the components it gives.
 * @returns Menu action with catalog information.
 */
function gameEntityAddMenuVariantEntry(
  actions: AddMenuActions,
  gameClass: GameEntityClass,
  variant: GameEntityAddMenuVariant,
): ToolbarMenuEntry {
  const create = (): THREE.Group => {
    const owner = gameEntityCreateForClass(gameClass, variant.components, variant.label);
    GameEntityVisualBuilder.refresh(owner);
    return owner;
  };
  return addMenuCatalogActionCreate(
    {
      label: variant.label,
      icon: GAME_ENTITY_MENU_ICON,
      iconColor: hexToRgb(GameEntityVisualBuilder.classColorOf(gameClass)),
      tooltip: `${variant.label} (${gameClass.label})`,
      onClick: () => actions.onAddEntityPlaced(create, GAME_ENTITY_PLACEMENT_RADIUS),
    },
    {
      id: `${gameEntityClassIdOf(gameClass.type_path)}.${variant.valueText}`,
      placeAtAim: (aim) => actions.onAddEntityPlaced(create, GAME_ENTITY_PLACEMENT_RADIUS, aim),
      objectMatches: (object) => gameEntityAddMenuVariantMatches(object, gameClass, variant),
      previewCreate: create,
    },
  );
}

/**
 * Returns whether an object carries a class with its marker box field holding a
 * variant's value.
 *
 * @param object Candidate scene object.
 * @param gameClass Component class.
 * @param variant Field value to match.
 * @returns True for matching objects.
 */
function gameEntityAddMenuVariantMatches(
  object: THREE.Object3D,
  gameClass: GameEntityClass,
  variant: GameEntityAddMenuVariant,
): boolean {
  const components = GameEntityComponentStore.read(object);
  if (!Object.hasOwn(components, gameClass.type_path)) {
    return false;
  }
  return GameEntityVisualMarkerBox.fieldValueTextOf(gameClass, components) === variant.valueText;
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
      id: gameEntityClassIdOf(gameClass.type_path),
      placeAtAim: (aim) =>
        actions.onAddEntityPlaced(() => gameEntityCreateForClass(gameClass), GAME_ENTITY_PLACEMENT_RADIUS, aim),
      objectMatches: (object) => Object.hasOwn(GameEntityComponentStore.read(object), gameClass.type_path),
      previewCreate: () => gameEntityCreateForClass(gameClass),
    },
  );
}
