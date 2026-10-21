import type { LayerManager } from '@/layer/model/layer_manager.js';
import { objectInUnselectableLayerIs } from '@/layer/model/layer_membership.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';

/**
 * Drops objects from the selection as soon as their layer becomes hidden or
 * locked, or they move into such a layer.
 */
export class LayerSelectionGuard {
  private readonly layerManager: LayerManager;
  private readonly selectionManager: ManagerSelection;
  private readonly changeListener: () => void;

  /**
   * Creates the guard and starts following layer changes.
   *
   * @param layerManager Layer manager to follow.
   * @param selectionManager Object selection to prune.
   */
  constructor(layerManager: LayerManager, selectionManager: ManagerSelection) {
    this.layerManager = layerManager;
    this.selectionManager = selectionManager;
    this.changeListener = () => this.selectionPrune();
    this.layerManager.changeListenerAdd(this.changeListener);
  }

  /**
   * Removes every selected object that is in a hidden or locked layer.
   *
   * @returns True when the selection changed.
   */
  selectionPrune(): boolean {
    const selectedMeshes = this.selectionManager.getAllSelectedObjectsAsArray();
    const survivingMeshes = selectedMeshes.filter((mesh) => !objectInUnselectableLayerIs(mesh));
    if (survivingMeshes.length === selectedMeshes.length) {
      return false;
    }
    return this.selectionManager.setSelection(survivingMeshes);
  }

  /** Stops following layer changes. */
  dispose(): void {
    this.layerManager.changeListenerRemove(this.changeListener);
  }
}
