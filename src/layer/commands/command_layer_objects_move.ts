import type * as THREE from 'three';
import { CommandLayer } from '@/layer/commands/command_layer.js';
import type { LayerManager } from '@/layer/model/layer_manager.js';
import { layerIdStoredRead, layerIdStoredWrite, layerTopLevelObjectResolve } from '@/layer/model/layer_membership.js';

/** One top-level object and the layer it stored before the move. */
interface LayerObjectMoveRecord {
  object: THREE.Object3D;
  previousLayerIdentifier: string | null;
}

/**
 * Undoable move of objects into a layer. Nested objects move with their
 * top-level ancestor, since only top-level objects belong to layers directly.
 */
export class CommandLayerObjectsMove extends CommandLayer {
  private readonly targetLayerIdentifier: string;
  private readonly records: LayerObjectMoveRecord[];

  /**
   * Creates the command.
   *
   * @param layerManager Layer manager of the objects' world.
   * @param objects Objects to move; their top-level ancestors are moved.
   * @param targetLayerIdentifier Layer to move them into.
   */
  constructor(layerManager: LayerManager, objects: readonly THREE.Object3D[], targetLayerIdentifier: string) {
    super(layerManager);
    this.targetLayerIdentifier = targetLayerIdentifier;
    this.records = CommandLayerObjectsMove.topLevelObjectsCollect(layerManager, objects).map((object) => ({
      object,
      previousLayerIdentifier: layerIdStoredRead(object),
    }));
  }

  /**
   * Returns the top-level objects the command moves.
   *
   * @returns Moved objects.
   */
  objectsRead(): THREE.Object3D[] {
    return this.records.map((record) => record.object);
  }

  /**
   * Returns whether the layer exists and at least one object is not in it yet.
   *
   * @returns True when the command has an effect.
   */
  hasChanges(): boolean {
    if (this.layerManager.layerFind(this.targetLayerIdentifier) === null) {
      return false;
    }
    return this.records.some(
      (record) => this.layerManager.layerOfTopLevelObjectResolve(record.object)?.id !== this.targetLayerIdentifier,
    );
  }

  /** Stores the target layer on every moved object. */
  execute(): void {
    this.layerManager.objectsLayerAssign(this.objectsRead(), this.targetLayerIdentifier);
  }

  /** Restores the layer every moved object stored before. */
  undo(): void {
    this.records.forEach((record) => layerIdStoredWrite(record.object, record.previousLayerIdentifier));
    this.layerManager.changeNotify();
  }

  /**
   * Resolves objects to their distinct, layer-assignable top-level ancestors in
   * the manager's world.
   *
   * @param layerManager Layer manager of the world.
   * @param objects Objects to resolve.
   * @returns Distinct top-level objects.
   */
  private static topLevelObjectsCollect(
    layerManager: LayerManager,
    objects: readonly THREE.Object3D[],
  ): THREE.Object3D[] {
    const topLevelObjects = new Set<THREE.Object3D>();
    objects.forEach((object) => {
      const topLevelObject = layerTopLevelObjectResolve(object);
      const isInWorld = topLevelObject !== null && topLevelObject.parent === layerManager.worldGroupRead();
      if (isInWorld && layerManager.topLevelObjectAssignableIs(topLevelObject)) {
        topLevelObjects.add(topLevelObject);
      }
    });
    return [...topLevelObjects];
  }
}
