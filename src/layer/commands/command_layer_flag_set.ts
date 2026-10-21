import { CommandLayer } from '@/layer/commands/command_layer.js';
import type { LayerFlagName } from '@/layer/model/layer_definition.js';
import type { LayerManager } from '@/layer/model/layer_manager.js';

/**
 * Undoable change of one switch (hidden, locked or omit from export) of a
 * layer.
 */
export class CommandLayerFlagSet extends CommandLayer {
  private readonly layerIdentifier: string;
  private readonly flag: LayerFlagName;
  private readonly nextValue: boolean;
  private readonly previousValue: boolean;

  /**
   * Creates the command.
   *
   * @param layerManager Layer manager holding the layer.
   * @param layerIdentifier Layer to change.
   * @param flag Switch to set.
   * @param value New value.
   */
  constructor(layerManager: LayerManager, layerIdentifier: string, flag: LayerFlagName, value: boolean) {
    super(layerManager);
    this.layerIdentifier = layerIdentifier;
    this.flag = flag;
    this.nextValue = value;
    this.previousValue = layerManager.layerFind(layerIdentifier)?.[flag] ?? value;
  }

  /**
   * Returns whether the layer exists and the switch would change.
   *
   * @returns True when the command has an effect.
   */
  hasChanges(): boolean {
    const definition = this.layerManager.layerFind(this.layerIdentifier);
    return definition !== null && definition[this.flag] !== this.nextValue;
  }

  /** Applies the new value. */
  execute(): void {
    this.layerManager.layerFlagSet(this.layerIdentifier, this.flag, this.nextValue);
  }

  /** Restores the previous value. */
  undo(): void {
    this.layerManager.layerFlagSet(this.layerIdentifier, this.flag, this.previousValue);
  }
}
