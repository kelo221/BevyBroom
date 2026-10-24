import type * as THREE from 'three';
import { SelectionQuery, type SelectionQueryId } from './selection_query.js';

/** Selects unselected meshes that lie entirely inside a selected mesh bounds. */
export class SelectionQueryInside extends SelectionQuery {
  readonly id: SelectionQueryId = 'inside';
  readonly label = 'Inside';

  /**
   * Returns the unselected candidates contained in any selected mesh bounds.
   *
   * @param candidates Selectable meshes of the scene.
   * @param selected Currently selected meshes.
   * @returns Contained candidates.
   */
  select(candidates: readonly THREE.Mesh[], selected: readonly THREE.Mesh[]): THREE.Mesh[] {
    const selectedBounds = this.selectedWorldBounds(selected);
    return this.unselectedFilter(candidates, selected, (candidate) => {
      const bounds = this.meshWorldBounds(candidate);
      return selectedBounds.some((box) => box.containsBox(bounds));
    });
  }
}
