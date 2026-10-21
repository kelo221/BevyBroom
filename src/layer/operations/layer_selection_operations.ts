import type * as THREE from 'three';
import type { LayerOperations } from '@/layer/operations/layer_operations.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import { selectionMeshesFromHierarchyCollect } from '@/selection/object/selection_hierarchy_meshes.js';

/** Layer edits that read or write the object selection. */
export class LayerSelectionOperations {
  private readonly layerOperations: LayerOperations;
  private readonly selectionManager: ManagerSelection;

  /**
   * Creates the selection operations.
   *
   * @param layerOperations Undoable layer edits.
   * @param selectionManager Object selection.
   */
  constructor(layerOperations: LayerOperations, selectionManager: ManagerSelection) {
    this.layerOperations = layerOperations;
    this.selectionManager = selectionManager;
  }

  /**
   * Returns whether anything is selected.
   *
   * @returns True when at least one object is selected.
   */
  selectionAnyIs(): boolean {
    return this.selectionManager.getSelectedObjectCount() > 0;
  }

  /**
   * Moves the selected objects into a layer as one undoable edit.
   *
   * @param layerIdentifier Target layer.
   * @returns The top-level objects that moved.
   */
  selectionMoveToLayer(layerIdentifier: string): THREE.Object3D[] {
    const selectedObjects = this.selectionManager.getInspectorObjects();
    return this.layerOperations.objectsMoveToLayer(selectedObjects, layerIdentifier);
  }

  /**
   * Returns whether the objects of a layer can be selected.
   *
   * @param layerIdentifier Layer to test.
   * @returns True when the layer exists, is shown, is unlocked and has objects.
   */
  layerSelectableIs(layerIdentifier: string): boolean {
    const definition = this.layerOperations.layerManager.layerFind(layerIdentifier);
    const isUsable = definition !== null && !definition.hidden && !definition.locked;
    return isUsable && this.layerOperations.layerManager.objectCountRead(layerIdentifier) > 0;
  }

  /**
   * Replaces the selection with every object of a shown, unlocked layer.
   *
   * @param layerIdentifier Layer whose objects are selected.
   * @returns True when the selection was replaced.
   */
  layerObjectsSelect(layerIdentifier: string): boolean {
    if (!this.layerSelectableIs(layerIdentifier)) {
      return false;
    }
    const topLevelObjects = this.layerOperations.layerManager.objectsInLayerCollect(layerIdentifier);
    const meshes = selectionMeshesFromHierarchyCollect(topLevelObjects);
    return this.selectionManager.setSelection(meshes, topLevelObjects);
  }
}
