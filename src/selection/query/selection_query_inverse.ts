import type * as THREE from 'three';
import { SelectionQuery, type SelectionQueryId } from './selection_query.js';

/** Selects every selectable mesh that is not selected. */
export class SelectionQueryInverse extends SelectionQuery {
  readonly id: SelectionQueryId = 'inverse';
  readonly label = 'Inverse';
  override readonly needsSelection = false;

  /**
   * Returns the unselected candidates.
   *
   * @param candidates Selectable meshes of the scene.
   * @param selected Currently selected meshes.
   * @returns Every unselected candidate.
   */
  select(candidates: readonly THREE.Mesh[], selected: readonly THREE.Mesh[]): THREE.Mesh[] {
    return this.unselectedFilter(candidates, selected, () => true);
  }
}
