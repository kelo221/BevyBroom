import type { UndoCommand } from '@/commands/command_undo.js';
import type { LayerManager } from '@/layer/model/layer_manager.js';

/**
 * Base of the undoable layer commands: each one changes the layers of one layer
 * manager and can tell beforehand whether it would change anything.
 */
export abstract class CommandLayer implements UndoCommand {
  protected readonly layerManager: LayerManager;

  /**
   * Creates a layer command.
   *
   * @param layerManager Layer manager the command changes.
   */
  constructor(layerManager: LayerManager) {
    this.layerManager = layerManager;
  }

  /**
   * Returns whether executing the command would change the layers.
   *
   * @returns True when the command has an effect.
   */
  abstract hasChanges(): boolean;

  /** Applies the command. */
  abstract execute(): void;

  /** Reverts the command. */
  abstract undo(): void;
}
