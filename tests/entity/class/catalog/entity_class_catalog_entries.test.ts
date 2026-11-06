import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import { EntityClassCatalogEntries } from '@/entity/class/catalog/entity_class_catalog_entries.js';
import { EntityClassRegistry } from '@/entity/class/registry/entity_class_registry.js';
import type { AddMenuActions } from '@/layout/setup/add_menu_entries.js';
import { gameEntityClassIdOf } from '@/game_entity/class/game_entity_class_id.js';
import { GAME_ENTITY_PROPERTIES_TYPE_PATH } from '@/game_entity/class/game_entity_class_provider_builtin.js';
import { testClassesInstall } from '../../../game_entity/game_entity_test_classes.js';

/**
 * Creates Add menu actions whose entity placement records the factories it
 * receives and whose other actions do nothing.
 *
 * @returns Actions and the recorded factories.
 */
function actionsCreate(): { actions: AddMenuActions; factories: Array<() => THREE.Group> } {
  const factories: Array<() => THREE.Group> = [];
  const doNothing = vi.fn();
  const actions: AddMenuActions = {
    onAddCube: doNothing,
    onAddSphere: doNothing,
    onAddCylinder: doNothing,
    onAddPlane: doNothing,
    onAddTerrain: doNothing,
    onAddSolidModel: doNothing,
    onAddBevelVolume: doNothing,
    onAddPointLight: doNothing,
    onAddSpotLight: doNothing,
    onAddRoom: doNothing,
    onAddPortal: doNothing,
    onAddEntityPlaced: (factory) => factories.push(factory),
  };
  return { actions, factories };
}

/**
 * The Entity tool's class list holds the point classes, lights, rooms, portals
 * and game classes, and no geometry; picking an entry places an owner of that
 * class.
 */
describe('EntityClassCatalogEntries', () => {
  let uninstall: () => void = () => {};

  beforeEach(() => {
    uninstall = testClassesInstall().uninstall;
  });

  afterEach(() => {
    uninstall();
  });

  it('lists one entry per placeable point class and no geometry primitives', () => {
    const entries = EntityClassCatalogEntries.pointEntriesBuild(actionsCreate().actions);
    const pointClassIds = EntityClassRegistry.pointClassesPlaceableList().map((pointClass) => pointClass.id);
    expect(entries.map((entry) => entry.id)).toEqual(pointClassIds);
    expect(entries.map((entry) => entry.label)).toEqual(
      expect.arrayContaining(['Point Light', 'Spot Light', 'Room', 'Portal', 'Door', 'Spinner']),
    );
    expect(entries.some((entry) => entry.id.startsWith('geometry.'))).toBe(false);
    expect(entries.map((entry) => entry.label)).not.toContain('Cube');
  });

  it('leaves data-only game classes such as Properties out of the entity class list', () => {
    const entries = EntityClassCatalogEntries.pointEntriesBuild(actionsCreate().actions);
    const dataOnlyIds = EntityClassRegistry.pointClassesList()
      .filter((pointClass) => !pointClass.placeableIs())
      .map((pointClass) => pointClass.id);
    expect(dataOnlyIds).toContain(gameEntityClassIdOf(GAME_ENTITY_PROPERTIES_TYPE_PATH));
    dataOnlyIds.forEach((dataOnlyId) => expect(entries.map((entry) => entry.id)).not.toContain(dataOnlyId));
  });

  it('numbers entries and categories in display order', () => {
    const entries = EntityClassCatalogEntries.pointEntriesBuild(actionsCreate().actions);
    expect(entries.map((entry) => entry.catalogIndex)).toEqual(entries.map((_entry, index) => index));
    const firstIndexByCategory = new Map<string, number>();
    for (const entry of entries) {
      const known = firstIndexByCategory.get(entry.category);
      if (known === undefined) {
        expect(entry.categoryIndex).toBe(firstIndexByCategory.size);
        firstIndexByCategory.set(entry.category, entry.categoryIndex);
      } else {
        expect(entry.categoryIndex).toBe(known);
      }
    }
  });

  it('places an owner of the entry class that the entry recognizes', () => {
    const { actions, factories } = actionsCreate();
    for (const entry of EntityClassCatalogEntries.pointEntriesBuild(actions)) {
      entry.activate();
      const factory = factories[factories.length - 1];
      if (!factory) throw new Error(`activating ${entry.label} places an entity`);
      const owner = factory();
      expect(EntityClassRegistry.classOf(owner)?.id).toBe(entry.id);
      expect(entry.objectMatches?.(owner)).toBe(true);
    }
  });
});
