import { CommandLayer } from '@/layer/commands/command_layer.js';
import { type LayerDefinition, layerDefinitionCopy } from '@/layer/model/layer_definition.js';
import type { LayerManager } from '@/layer/model/layer_manager.js';

/** Undoable creation of a layer at the end of the layer list. */
export class CommandLayerCreate extends CommandLayer {
  private readonly definition: LayerDefinition;

  /**
   * Creates the command and allocates the new layer.
   *
   * @param layerManager Layer manager to add the layer to.
   * @param name Optional name; "Layer N" is used when missing or blank.
   */
  constructor(layerManager: LayerManager, name?: string) {
    super(layerManager);
    this.definition = layerManager.layerDefinitionAllocate();
    if (name !== undefined && name.trim().length > 0) {
      this.definition.name = name.trim();
    }
  }

  /**
   * Returns the layer the command creates.
   *
   * @returns Copy of the new layer.
   */
  definitionRead(): LayerDefinition {
    return layerDefinitionCopy(this.definition);
  }

  /**
   * Returns whether the layer can still be added.
   *
   * @returns True while no layer uses the new identifier.
   */
  hasChanges(): boolean {
    return this.layerManager.layerFind(this.definition.id) === null;
  }

  /** Adds the layer at the end of the list. */
  execute(): void {
    this.layerManager.layerInsert(this.definition, this.layerManager.layersList().length);
  }

  /** Removes the layer again. */
  undo(): void {
    this.layerManager.layerDelete(this.definition.id);
  }
}
