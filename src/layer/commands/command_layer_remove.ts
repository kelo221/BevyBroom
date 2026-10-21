import type * as THREE from 'three';
import { CommandLayer } from '@/layer/commands/command_layer.js';
import { LAYER_DEFAULT_ID, type LayerDefinition, layerDefinitionCopy } from '@/layer/model/layer_definition.js';
import type { LayerManager } from '@/layer/model/layer_manager.js';

/**
 * Undoable removal of a layer other than the default; its objects move to the
 * default layer.
 */
export class CommandLayerRemove extends CommandLayer {
  private readonly layerIdentifier: string;
  private removedDefinition: LayerDefinition | null;
  private removedIndex: number;
  private wasCurrent: boolean;
  private movedObjects: THREE.Object3D[];

  /**
   * Creates the command.
   *
   * @param layerManager Layer manager holding the layer.
   * @param layerIdentifier Layer to remove.
   */
  constructor(layerManager: LayerManager, layerIdentifier: string) {
    super(layerManager);
    this.layerIdentifier = layerIdentifier;
    this.removedDefinition = null;
    this.removedIndex = -1;
    this.wasCurrent = false;
    this.movedObjects = [];
  }

  /**
   * Returns whether the layer exists and is not the default.
   *
   * @returns True when the layer can be removed.
   */
  hasChanges(): boolean {
    return this.layerIdentifier !== LAYER_DEFAULT_ID && this.layerManager.layerFind(this.layerIdentifier) !== null;
  }

  /** Moves the layer's objects to the default layer and removes the layer. */
  execute(): void {
    const definition = this.layerManager.layerFind(this.layerIdentifier);
    if (definition === null || this.layerIdentifier === LAYER_DEFAULT_ID) {
      return;
    }
    this.removedDefinition = layerDefinitionCopy(definition);
    this.wasCurrent = this.layerManager.currentLayerIdRead() === this.layerIdentifier;
    this.movedObjects = this.layerManager.objectsInLayerCollect(this.layerIdentifier);
    this.layerManager.objectsLayerAssign(this.movedObjects, LAYER_DEFAULT_ID);
    this.removedIndex = this.layerManager.layerDelete(this.layerIdentifier);
  }

  /** Restores the layer at its index, its objects and the current layer. */
  undo(): void {
    if (this.removedDefinition === null) {
      return;
    }
    this.layerManager.layerInsert(this.removedDefinition, this.removedIndex);
    this.layerManager.objectsLayerAssign(this.movedObjects, this.layerIdentifier);
    if (this.wasCurrent) {
      this.layerManager.currentLayerSet(this.layerIdentifier);
    }
    this.removedDefinition = null;
  }
}
