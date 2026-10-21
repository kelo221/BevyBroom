import type * as THREE from 'three';
import { isEditorHelperObject } from '@/utils/mesh_edge_sync.js';
import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';

/** Counts how many scene objects are instances of each catalog entry. */
export class EntityBrowserCatalogUsage {
  /**
   * Counts the content objects under a root that each entry recognizes. Editor
   * helpers and their descendants are skipped; the root itself is not counted.
   *
   * @param worldRoot Scene hierarchy root.
   * @param entries Catalog entries.
   * @returns Instance count by entry id; entries without a matcher are absent.
   */
  static countsResolve(worldRoot: THREE.Object3D, entries: readonly EntityBrowserCatalogEntry[]): Map<string, number> {
    const counts = new Map<string, number>();
    const countedEntries = entries.filter((entry) => entry.objectMatches !== null);
    for (const child of worldRoot.children) {
      EntityBrowserCatalogUsage.contentObjectCount(child, countedEntries, counts);
    }
    return counts;
  }

  /**
   * Counts one content object and its content descendants.
   *
   * @param object Scene object.
   * @param entries Entries with an object matcher.
   * @param counts Counts updated in place.
   */
  private static contentObjectCount(
    object: THREE.Object3D,
    entries: readonly EntityBrowserCatalogEntry[],
    counts: Map<string, number>,
  ): void {
    if (isEditorHelperObject(object)) {
      return;
    }
    for (const entry of entries) {
      if (entry.objectMatches?.(object) === true) {
        counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
      }
    }
    for (const child of object.children) {
      EntityBrowserCatalogUsage.contentObjectCount(child, entries, counts);
    }
  }
}
