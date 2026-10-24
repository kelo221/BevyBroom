import * as THREE from 'three';
import { SelectionQuery, type SelectionQueryId } from './selection_query.js';

/**
 * Selects unselected meshes whose floor footprint (X and Z) lies inside a
 * selected mesh footprint at any height.
 */
export class SelectionQueryTall extends SelectionQuery {
  readonly id: SelectionQueryId = 'tall';
  readonly label = 'Tall';

  /**
   * Returns the unselected candidates inside any selected footprint.
   *
   * @param candidates Selectable meshes of the scene.
   * @param selected Currently selected meshes.
   * @returns Candidates under or above the selection.
   */
  select(candidates: readonly THREE.Mesh[], selected: readonly THREE.Mesh[]): THREE.Mesh[] {
    const footprints = this.selectedWorldBounds(selected).map((box) => this.footprintRect(box));
    return this.unselectedFilter(candidates, selected, (candidate) => {
      const footprint = this.footprintRect(this.meshWorldBounds(candidate));
      return footprints.some((rect) => rect.containsBox(footprint));
    });
  }

  /**
   * Projects world bounds onto the floor plane.
   *
   * @param bounds World bounds.
   * @returns Rectangle over X and Z.
   */
  private footprintRect(bounds: THREE.Box3): THREE.Box2 {
    return new THREE.Box2(new THREE.Vector2(bounds.min.x, bounds.min.z), new THREE.Vector2(bounds.max.x, bounds.max.z));
  }
}
