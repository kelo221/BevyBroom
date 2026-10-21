import * as THREE from 'three';
import type { SelectionChangedCallback } from '@/selection/object/manager_selection.js';

/** Edge length of the reference cube used when nothing was ever selected. */
export const SHAPE_DRAW_DEFAULT_REFERENCE_EDGE = 2;

/** Selection members the reference bounds tracker reads. */
export interface ShapeDrawReferenceSelectionSource {
  getAllSelectedObjectsAsArray(): THREE.Mesh[];
  onSelectionChanged(callback: SelectionChangedCallback): void;
  offSelectionChanged(callback: SelectionChangedCallback): void;
}

/**
 * Supplies the world bounds 2D shape drags take their depth from: the current
 * selection, else the most recent non-empty selection, else a cube centered at
 * the world origin.
 */
export class ShapeDrawReferenceBoundsTracker {
  private readonly selectionSource: ShapeDrawReferenceSelectionSource;
  private rememberedSelectionMeshes: THREE.Mesh[] = [];
  private readonly selectionChangedListener: SelectionChangedCallback;

  /**
   * Starts remembering non-empty selections.
   *
   * @param selectionSource Selection state to observe.
   */
  constructor(selectionSource: ShapeDrawReferenceSelectionSource) {
    this.selectionSource = selectionSource;
    this.selectionChangedListener = (selected) => this.selectionRemember(selected);
    selectionSource.onSelectionChanged(this.selectionChangedListener);
    this.selectionRemember(new Set(selectionSource.getAllSelectedObjectsAsArray()));
  }

  /**
   * Returns the reference world bounds for a new shape.
   *
   * @returns New world box that is never empty.
   */
  referenceBoundsResolve(): THREE.Box3 {
    const currentBounds = this.meshesWorldBounds(this.selectionSource.getAllSelectedObjectsAsArray());
    if (!currentBounds.isEmpty()) {
      return currentBounds;
    }
    const rememberedBounds = this.meshesWorldBounds(this.rememberedSelectionMeshes);
    if (!rememberedBounds.isEmpty()) {
      return rememberedBounds;
    }
    const halfEdge = SHAPE_DRAW_DEFAULT_REFERENCE_EDGE / 2;
    return new THREE.Box3(
      new THREE.Vector3(-halfEdge, -halfEdge, -halfEdge),
      new THREE.Vector3(halfEdge, halfEdge, halfEdge),
    );
  }

  /** Stops observing the selection. */
  dispose(): void {
    this.selectionSource.offSelectionChanged(this.selectionChangedListener);
    this.rememberedSelectionMeshes = [];
  }

  /**
   * Remembers a selection when it is not empty.
   *
   * @param selected Newly selected meshes.
   */
  private selectionRemember(selected: Set<THREE.Mesh>): void {
    if (selected.size === 0) {
      return;
    }
    this.rememberedSelectionMeshes = Array.from(selected);
  }

  /**
   * Computes the world bounds enclosing meshes.
   *
   * @param meshes Meshes to enclose.
   * @returns New world box (empty when there are no meshes).
   */
  private meshesWorldBounds(meshes: readonly THREE.Mesh[]): THREE.Box3 {
    const bounds = new THREE.Box3();
    for (const mesh of meshes) {
      mesh.updateMatrixWorld(true);
      bounds.union(new THREE.Box3().setFromObject(mesh));
    }
    return bounds;
  }
}
