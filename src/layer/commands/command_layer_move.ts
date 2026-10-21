import { CommandLayer } from '@/layer/commands/command_layer.js';
import type { LayerManager } from '@/layer/model/layer_manager.js';

/** Direction a layer moves in the list: -1 is up, 1 is down. */
export type LayerMoveDirection = -1 | 1;

/**
 * Undoable move of a layer one step up or down the list. The default layer
 * stays first.
 */
export class CommandLayerMove extends CommandLayer {
  private readonly layerIdentifier: string;
  private readonly direction: LayerMoveDirection;
  private previousIndex: number;

  /**
   * Creates the command.
   *
   * @param layerManager Layer manager holding the layer.
   * @param layerIdentifier Layer to move.
   * @param direction -1 to move up, 1 to move down.
   */
  constructor(layerManager: LayerManager, layerIdentifier: string, direction: LayerMoveDirection) {
    super(layerManager);
    this.layerIdentifier = layerIdentifier;
    this.direction = direction;
    this.previousIndex = -1;
  }

  /**
   * Returns whether the layer can move in the direction.
   *
   * @returns True when the move stays after the default layer and in the list.
   */
  hasChanges(): boolean {
    const index = this.layerManager.layerIndexOf(this.layerIdentifier);
    const targetIndex = index + this.direction;
    return index > 0 && targetIndex > 0 && targetIndex < this.layerManager.layersList().length;
  }

  /** Moves the layer one step. */
  execute(): void {
    this.previousIndex = this.layerManager.layerIndexOf(this.layerIdentifier);
    this.layerManager.layerMoveToIndex(this.layerIdentifier, this.previousIndex + this.direction);
  }

  /** Moves the layer back to where it was. */
  undo(): void {
    this.layerManager.layerMoveToIndex(this.layerIdentifier, this.previousIndex);
  }
}
