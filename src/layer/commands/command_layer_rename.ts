import { CommandLayer } from '@/layer/commands/command_layer.js';
import { LAYER_DEFAULT_ID } from '@/layer/model/layer_definition.js';
import type { LayerManager } from '@/layer/model/layer_manager.js';

/** Undoable rename of a layer other than the default. */
export class CommandLayerRename extends CommandLayer {
  private readonly layerIdentifier: string;
  private readonly nextName: string;
  private readonly previousName: string;

  /**
   * Creates the command.
   *
   * @param layerManager Layer manager holding the layer.
   * @param layerIdentifier Layer to rename.
   * @param name New name; surrounding spaces are dropped.
   */
  constructor(layerManager: LayerManager, layerIdentifier: string, name: string) {
    super(layerManager);
    this.layerIdentifier = layerIdentifier;
    this.nextName = name.trim();
    this.previousName = layerManager.layerFind(layerIdentifier)?.name ?? '';
  }

  /**
   * Returns whether the layer can be renamed to a different, non-blank name.
   *
   * @returns True when the rename changes the layer.
   */
  hasChanges(): boolean {
    const isRenamable = this.layerIdentifier !== LAYER_DEFAULT_ID && this.nextName.length > 0;
    return isRenamable && this.layerManager.layerFind(this.layerIdentifier)?.name !== this.nextName;
  }

  /** Applies the new name. */
  execute(): void {
    this.layerManager.layerRename(this.layerIdentifier, this.nextName);
  }

  /** Restores the previous name. */
  undo(): void {
    this.layerManager.layerRename(this.layerIdentifier, this.previousName);
  }
}
