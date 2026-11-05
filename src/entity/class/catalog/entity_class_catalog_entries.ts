import type { EntityClassPoint } from '@/entity/class/entity_class.js';
import { EntityClassRegistry } from '@/entity/class/registry/entity_class_registry.js';
import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';
import type { AddMenuActions } from '@/layout/setup/add_menu_entries.js';
import { hexToRgb } from '@/utils/utils_color.js';

/** Approximate half-extent of a new point entity, used for wall clearance. */
const ENTITY_CLASS_CATALOG_PLACEMENT_RADIUS = 0.3;

/**
 * Turns the point classes into catalog entries the Entity tool lists, like
 * Hammer's entity tool: lights, rooms, portals and game classes, but no
 * geometry.
 */
export class EntityClassCatalogEntries {
  /**
   * Builds one entry per placeable point class; activating an entry places a
   * new owner of the class at the spawn point.
   *
   * @param actions Creation callbacks that place entity owners.
   * @returns Entries in class display order.
   */
  static pointEntriesBuild(actions: AddMenuActions): EntityBrowserCatalogEntry[] {
    const categoryIndices = new Map<string, number>();
    return EntityClassRegistry.pointClassesPlaceableList().map((pointClass, catalogIndex) =>
      EntityClassCatalogEntries.entryCreate(pointClass, catalogIndex, categoryIndices, actions),
    );
  }

  /**
   * Builds the entry of one point class.
   *
   * @param pointClass Point class.
   * @param catalogIndex Position of the entry.
   * @param categoryIndices Order of the categories seen so far; extended here.
   * @param actions Creation callbacks.
   * @returns Catalog entry.
   */
  private static entryCreate(
    pointClass: EntityClassPoint,
    catalogIndex: number,
    categoryIndices: Map<string, number>,
    actions: AddMenuActions,
  ): EntityBrowserCatalogEntry {
    const categoryIndex = categoryIndices.get(pointClass.category) ?? categoryIndices.size;
    categoryIndices.set(pointClass.category, categoryIndex);
    const iconColorHex = pointClass.iconColorHex();
    return {
      id: pointClass.id,
      label: pointClass.label,
      category: pointClass.category,
      categoryIndex,
      catalogIndex,
      iconName: pointClass.iconName(),
      iconColor: iconColorHex === null ? null : hexToRgb(iconColorHex),
      tooltip: pointClass.helpText,
      objectMatches: (object) => pointClass.matches(object),
      activate: () => actions.onAddEntityPlaced(() => pointClass.ownerCreate(), ENTITY_CLASS_CATALOG_PLACEMENT_RADIUS),
    };
  }
}
