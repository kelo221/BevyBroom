import type * as THREE from 'three';
import { SelectionQuery, type SelectionQueryId } from './selection_query.js';

/** Selects every mesh that shares a parent with a selected mesh. */
export class SelectionQuerySiblings extends SelectionQuery {
  readonly id: SelectionQueryId = 'siblings';
  readonly label = 'Siblings';

  /**
   * Returns the candidates whose parent also holds a selected mesh.
   *
   * @param candidates Selectable meshes of the scene.
   * @param selected Currently selected meshes.
   * @returns Selected meshes and their siblings.
   */
  select(candidates: readonly THREE.Mesh[], selected: readonly THREE.Mesh[]): THREE.Mesh[] {
    const parents = new Set(selected.map((mesh) => mesh.parent));
    return candidates.filter((candidate) => parents.has(candidate.parent));
  }
}
