import type * as THREE from 'three';
import { SelectionQuery, type SelectionQueryId } from './selection_query.js';

/** Selects unselected meshes whose bounds touch or overlap a selected mesh. */
export class SelectionQueryTouching extends SelectionQuery {
  readonly id: SelectionQueryId = 'touching';
  readonly label = 'Touching';

  /**
   * Returns the unselected candidates touching any selected mesh bounds.
   *
   * @param candidates Selectable meshes of the scene.
   * @param selected Currently selected meshes.
   * @returns Touching candidates.
   */
  select(candidates: readonly THREE.Mesh[], selected: readonly THREE.Mesh[]): THREE.Mesh[] {
    const selectedBounds = this.selectedWorldBounds(selected);
    return this.unselectedFilter(candidates, selected, (candidate) => {
      const bounds = this.meshWorldBounds(candidate);
      return selectedBounds.some((box) => box.intersectsBox(bounds));
    });
  }
}
