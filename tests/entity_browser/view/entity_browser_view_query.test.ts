import { describe, expect, it } from 'vitest';
import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';
import {
  ENTITY_BROWSER_VIEW_OPTIONS_DEFAULT,
  type EntityBrowserViewOptions,
} from '@/entity_browser/view/entity_browser_view_options.js';
import { EntityBrowserViewQuery } from '@/entity_browser/view/entity_browser_view_query.js';
import { entityBrowserTestEntryCreate } from '../entity_browser_test_support.js';

/**
 * Builds a catalog with two categories whose entries are not in name order.
 *
 * @returns Catalog entries in catalog order.
 */
function catalogCreate(): EntityBrowserCatalogEntry[] {
  return [
    entityBrowserTestEntryCreate('lights.spot', 'Spot Light', 'Lights', 0, 0),
    entityBrowserTestEntryCreate('lights.point', 'point light', 'Lights', 0, 1),
    entityBrowserTestEntryCreate('geometry.box', 'Cube', 'Geometry', 1, 2),
    entityBrowserTestEntryCreate('geometry.plane', 'Plane', 'Geometry', 1, 3),
  ];
}

/**
 * Returns display choices that differ from the defaults in some fields.
 *
 * @param changes Fields to replace.
 * @returns Display choices.
 */
function optionsCreate(changes: Partial<EntityBrowserViewOptions>): EntityBrowserViewOptions {
  return { ...ENTITY_BROWSER_VIEW_OPTIONS_DEFAULT, ...changes };
}

/**
 * Returns the labels of every group, flattened.
 *
 * @param catalog Catalog entries.
 * @param options Display choices.
 * @param counts Usage counts.
 * @returns Labels in display order.
 */
function shownLabels(
  catalog: readonly EntityBrowserCatalogEntry[],
  options: EntityBrowserViewOptions,
  counts: ReadonlyMap<string, number> = new Map(),
): string[] {
  return EntityBrowserViewQuery.groupsResolve(catalog, options, counts).flatMap((group) =>
    group.entries.map((entry) => entry.label),
  );
}

/** The view query filters, sorts and groups the catalog for the tile grid. */
describe('EntityBrowserViewQuery', () => {
  it('sorts by name case-insensitively across categories', () => {
    const labels = shownLabels(catalogCreate(), optionsCreate({ sortMode: 'name', groupByCategory: false }));
    expect(labels).toEqual(['Cube', 'Plane', 'point light', 'Spot Light']);
  });

  it('sorts by category in Add menu order, then by name', () => {
    const labels = shownLabels(catalogCreate(), optionsCreate({ sortMode: 'category', groupByCategory: false }));
    expect(labels).toEqual(['point light', 'Spot Light', 'Cube', 'Plane']);
  });

  it('groups tiles under category headers, or shows one untitled list', () => {
    const grouped = EntityBrowserViewQuery.groupsResolve(
      catalogCreate(),
      optionsCreate({ sortMode: 'name', groupByCategory: true }),
      new Map(),
    );
    expect(grouped.map((group) => group.title)).toEqual(['Lights', 'Geometry']);
    expect(grouped[0]?.entries.map((entry) => entry.label)).toEqual(['point light', 'Spot Light']);
    const flat = EntityBrowserViewQuery.groupsResolve(
      catalogCreate(),
      optionsCreate({ groupByCategory: false }),
      new Map(),
    );
    expect(flat.map((group) => group.title)).toEqual([null]);
  });

  it('shows only used kinds when the Used filter is on', () => {
    const counts = new Map([
      ['geometry.plane', 2],
      ['lights.spot', 0],
    ]);
    const labels = shownLabels(catalogCreate(), optionsCreate({ usedOnly: true }), counts);
    expect(labels).toEqual(['Plane']);
  });

  it('filters by a case-insensitive name substring and drops empty groups', () => {
    const options = optionsCreate({ searchText: '  LIGHT ', groupByCategory: true });
    const groups = EntityBrowserViewQuery.groupsResolve(catalogCreate(), options, new Map());
    expect(groups.map((group) => group.title)).toEqual(['Lights']);
    expect(shownLabels(catalogCreate(), optionsCreate({ searchText: 'zzz' }))).toEqual([]);
  });
});
