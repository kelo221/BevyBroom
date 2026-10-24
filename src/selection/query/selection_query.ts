import * as THREE from 'three';

/** Identifiers of the selection queries in menu order. */
export const SELECTION_QUERY_IDS = ['inverse', 'siblings', 'touching', 'inside', 'tall', 'by_material'] as const;

/** Identifier of one selection query. */
export type SelectionQueryId = (typeof SELECTION_QUERY_IDS)[number];

/**
 * A rule that picks a new object selection from the selectable meshes of the
 * scene and the current selection.
 */
export abstract class SelectionQuery {
  /** Stable identifier. */
  abstract readonly id: SelectionQueryId;
  /** Menu label. */
  abstract readonly label: string;
  /** True when the query needs a current selection to mean anything. */
  readonly needsSelection: boolean = true;

  /**
   * Returns the meshes the query selects.
   *
   * @param candidates Selectable meshes of the scene.
   * @param selected Currently selected meshes.
   * @returns Meshes to select, in candidate order.
   */
  abstract select(candidates: readonly THREE.Mesh[], selected: readonly THREE.Mesh[]): THREE.Mesh[];

  /**
   * Returns the candidates that are not selected and pass a test.
   *
   * @param candidates Selectable meshes of the scene.
   * @param selected Currently selected meshes.
   * @param accept Test each unselected candidate must pass.
   * @returns Accepted unselected candidates.
   */
  protected unselectedFilter(
    candidates: readonly THREE.Mesh[],
    selected: readonly THREE.Mesh[],
    accept: (candidate: THREE.Mesh) => boolean,
  ): THREE.Mesh[] {
    const selectedSet = new Set(selected);
    return candidates.filter((candidate) => !selectedSet.has(candidate) && accept(candidate));
  }

  /**
   * Returns the world bounds of one mesh.
   *
   * @param mesh Mesh to measure.
   * @returns World bounds.
   */
  protected meshWorldBounds(mesh: THREE.Mesh): THREE.Box3 {
    mesh.updateWorldMatrix(true, false);
    return new THREE.Box3().setFromObject(mesh);
  }

  /**
   * Returns the world bounds of each selected mesh.
   *
   * @param selected Currently selected meshes.
   * @returns World bounds per mesh.
   */
  protected selectedWorldBounds(selected: readonly THREE.Mesh[]): THREE.Box3[] {
    return selected.map((mesh) => this.meshWorldBounds(mesh));
  }
}
