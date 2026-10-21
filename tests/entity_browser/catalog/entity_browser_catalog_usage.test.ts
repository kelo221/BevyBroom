import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EntityBrowserCatalogBuilder } from '@/entity_browser/catalog/entity_browser_catalog_builder.js';
import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';
import { EntityBrowserCatalogUsage } from '@/entity_browser/catalog/entity_browser_catalog_usage.js';
import { GAME_ENTITY_ADD_MENU_CLASS_ID_PREFIX } from '@/game_entity/ui/game_entity_add_menu_section.js';
import { testClassesInstall, testDoorClassCreate } from '../../game_entity/game_entity_test_classes.js';
import { entityBrowserTestEditorCreate } from '../entity_browser_test_support.js';

/**
 * Activates the catalog entry with an id a number of times.
 *
 * @param catalog Catalog entries.
 * @param entryId Entry id.
 * @param times Number of activations.
 */
function entryActivateTimes(catalog: readonly EntityBrowserCatalogEntry[], entryId: string, times: number): void {
  const entry = catalog.find((candidate) => candidate.id === entryId);
  expect(entry).toBeDefined();
  for (let index = 0; index < times; index++) {
    entry?.activate();
  }
}

/**
 * Usage counts classify the map content with the matchers the Add menu entries
 * carry, so the Used filter shows exactly the kinds the map holds.
 */
describe('EntityBrowserCatalogUsage', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('counts objects created through the Add actions by kind', () => {
    const { uninstall } = testClassesInstall();
    cleanups.push(uninstall);
    const editor = entityBrowserTestEditorCreate();
    const catalog = EntityBrowserCatalogBuilder.catalogBuild(editor.actions);
    const doorId = `${GAME_ENTITY_ADD_MENU_CLASS_ID_PREFIX}${testDoorClassCreate().type_path}`;
    entryActivateTimes(catalog, 'geometry.box', 2);
    entryActivateTimes(catalog, 'lights.point', 1);
    entryActivateTimes(catalog, 'portals.portal', 1);
    entryActivateTimes(catalog, doorId, 3);
    const counts = EntityBrowserCatalogUsage.countsResolve(editor.world, catalog);
    expect(counts.get('geometry.box')).toBe(2);
    expect(counts.get('lights.point')).toBe(1);
    expect(counts.get('portals.portal')).toBe(1);
    expect(counts.get(doorId)).toBe(3);
    expect(counts.get('lights.spot') ?? 0).toBe(0);
    expect(counts.get('portals.room') ?? 0).toBe(0);
    expect(counts.get('game_entity.empty') ?? 0).toBe(0);
  });

  it('counts nested content but not the root or entity marker parts', () => {
    const editor = entityBrowserTestEditorCreate();
    const catalog = EntityBrowserCatalogBuilder.catalogBuild(editor.actions);
    entryActivateTimes(catalog, 'lights.spot', 1);
    entryActivateTimes(catalog, 'geometry.sphere', 1);
    const folder = new THREE.Group();
    editor.world.children.slice().forEach((child) => folder.add(child));
    editor.world.add(folder);
    const counts = EntityBrowserCatalogUsage.countsResolve(editor.world, catalog);
    expect(counts.get('lights.spot')).toBe(1);
    expect(counts.get('geometry.sphere')).toBe(1);
    const totalCounted = [...counts.values()].reduce((sum, count) => sum + count, 0);
    expect(totalCounted).toBe(2);
  });
});
