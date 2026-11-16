import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { EntityBrowserCatalogBuilder } from '@/entity_browser/catalog/entity_browser_catalog_builder.js';
import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';
import { GAME_ENTITY_CLASS_ID_PREFIX } from '@/game_entity/class/game_entity_class_id.js';
import { addMenuCatalogPreviewPrimitive } from '@/layout/setup/add_menu_catalog_previews.js';
import { testClassesInstall, testDoorClassCreate } from '../../game_entity/game_entity_test_classes.js';
import { entityBrowserTestActionSpiesCreate } from '../../entity_browser/entity_browser_test_support.js';

/** Built-in primitive kinds, previewed as meshes of their shape. */
const PRIMITIVE_ENTRY_IDS = ['geometry.box', 'geometry.sphere', 'geometry.cylinder', 'geometry.plane'];

/** Built-in entity owner kinds, previewed as a standalone owner of the kind. */
const OWNER_ENTRY_IDS = ['lights.point', 'lights.spot', 'portals.room', 'portals.portal', 'game_entity.empty'];

/**
 * Returns the drawable meshes and lines under an object.
 *
 * @param root Preview object.
 * @returns Drawable objects with vertex positions.
 */
function drawablesCollect(root: THREE.Object3D): THREE.Object3D[] {
  const drawables: THREE.Object3D[] = [];
  root.traverse((object) => {
    const isDrawable = object instanceof THREE.Mesh || object instanceof THREE.Line;
    if (isDrawable && (object.geometry.getAttribute('position')?.count ?? 0) > 0) drawables.push(object);
  });
  return drawables;
}

/**
 * Builds the preview of a catalog entry and fails when it has none.
 *
 * @param catalog Catalog entries.
 * @param entryId Entry id.
 * @returns Entry and its preview object.
 */
function previewBuild(
  catalog: readonly EntityBrowserCatalogEntry[],
  entryId: string,
): { entry: EntityBrowserCatalogEntry; preview: THREE.Object3D } {
  const entry = catalog.find((candidate) => candidate.id === entryId);
  if (!entry?.previewCreate) throw new Error(`${entryId} has no preview`);
  return { entry, preview: entry.previewCreate() };
}

/**
 * Add menu kinds carry a standalone 3D preview of their meshes that catalogs
 * such as the entity browser draw, built without adding anything to the map.
 */
describe('Add menu catalog previews', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('previews each primitive as a mesh of visible size and runs no Add action', () => {
    const actions = entityBrowserTestActionSpiesCreate();
    const catalog = EntityBrowserCatalogBuilder.catalogBuild(actions);
    for (const entryId of PRIMITIVE_ENTRY_IDS) {
      const { preview } = previewBuild(catalog, entryId);
      expect(drawablesCollect(preview).some((object) => object instanceof THREE.Mesh)).toBe(true);
      const size = new THREE.Box3().setFromObject(preview).getSize(new THREE.Vector3());
      expect(Math.max(size.x, size.y, size.z)).toBeGreaterThan(0);
      expect(preview.parent).toBeNull();
    }
    Object.values(actions).forEach((action) => expect(action).not.toHaveBeenCalled());
  });

  it('previews entity kinds with an owner that the kind itself recognizes', () => {
    const { uninstall } = testClassesInstall();
    cleanups.push(uninstall);
    const doorEntryId = `${GAME_ENTITY_CLASS_ID_PREFIX}${testDoorClassCreate().type_path}`;
    const catalog = EntityBrowserCatalogBuilder.catalogBuild(entityBrowserTestActionSpiesCreate());
    for (const entryId of [...OWNER_ENTRY_IDS, doorEntryId]) {
      const { entry, preview } = previewBuild(catalog, entryId);
      expect(drawablesCollect(preview).length).toBeGreaterThan(0);
      expect(entry.objectMatches?.(preview)).toBe(true);
    }
  });

  it('builds a new preview object on every call so previews never share a parent', () => {
    const previewCreate = addMenuCatalogPreviewPrimitive('box');
    expect(previewCreate).toBeDefined();
    expect(previewCreate?.()).not.toBe(previewCreate?.());
  });
});
