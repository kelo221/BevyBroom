import { describe, expect, it, vi } from 'vitest';
import { StateEntityPlace } from '@/tools/entity_place/state_entity_place.js';
import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';

/**
 * Builds a fake EntityBrowserCatalogEntry for unit tests.
 *
 * @param id Entry id.
 * @param label Entry label.
 * @returns Catalog entry fixture.
 */
function makeEntry(id: string, label: string): EntityBrowserCatalogEntry {
  return {
    id,
    label,
    category: 'Game Entities',
    categoryIndex: 0,
    catalogIndex: 0,
    iconName: null,
    iconColor: null,
    tooltip: label,
    objectMatches: null,
    activate: vi.fn(),
  };
}

describe('StateEntityPlace', () => {
  it('tracks active entity entry and invokes placeDelegate at client point', () => {
    const state = new StateEntityPlace();
    const first = makeEntry('light_point', 'Point Light');
    const second = makeEntry('door_sliding', 'Sliding Door');
    state.entriesWrite([first, second]);
    expect(state.activeEntryRead()?.id).toBe('light_point');
    state.activeEntryIdWrite('door_sliding');
    expect(state.activeEntryRead()?.id).toBe('door_sliding');

    const placed: string[] = [];
    state.placeDelegateWrite((entry, x, y) => {
      placed.push(`${entry.id}@${x},${y}`);
      return true;
    });
    expect(state.placeAtClientPoint(120, 240)).toBe(true);
    expect(placed).toEqual(['door_sliding@120,240']);
  });

  it('opens the entity browser through the browse delegate only while one is registered', () => {
    const state = new StateEntityPlace();
    const browseDelegate = vi.fn();
    expect(state.browseRequest()).toBe(false);
    state.browseDelegateWrite(browseDelegate);
    expect(state.browseRequest()).toBe(true);
    expect(browseDelegate).toHaveBeenCalledOnce();
    state.browseDelegateWrite(null);
    expect(state.browseRequest()).toBe(false);
    expect(browseDelegate).toHaveBeenCalledOnce();
  });
});
