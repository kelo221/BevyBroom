import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import { CommandUndoBatch } from '@/commands/command_undo_batch.js';
import type { CommandLayer } from '@/layer/commands/command_layer.js';
import { CommandLayerCreate } from '@/layer/commands/command_layer_create.js';
import { CommandLayerFlagSet } from '@/layer/commands/command_layer_flag_set.js';
import { CommandLayerMove, type LayerMoveDirection } from '@/layer/commands/command_layer_move.js';
import { CommandLayerObjectsMove } from '@/layer/commands/command_layer_objects_move.js';
import { CommandLayerRemove } from '@/layer/commands/command_layer_remove.js';
import { CommandLayerRename } from '@/layer/commands/command_layer_rename.js';
import { LAYER_FLAG_NAMES, type LayerDefinition, type LayerFlagName } from '@/layer/model/layer_definition.js';
import type { LayerManager } from '@/layer/model/layer_manager.js';

/**
 * Layer edits shared by the layers panel and the AI tools. Every edit that
 * changes the document goes through an undoable command and is followed by the
 * editor refresh; edits without an effect push nothing.
 */
export class LayerOperations {
  readonly layerManager: LayerManager;
  private readonly commandStack: CommandStack;
  private readonly refresh: () => void;

  /**
   * Creates the operations.
   *
   * @param layerManager Layer manager to edit.
   * @param commandStack Undo stack the commands go onto.
   * @param refresh Editor refresh called after every applied edit.
   */
  constructor(layerManager: LayerManager, commandStack: CommandStack, refresh: () => void) {
    this.layerManager = layerManager;
    this.commandStack = commandStack;
    this.refresh = refresh;
  }

  /**
   * Adds a layer at the end of the list.
   *
   * @param name Optional name; "Layer N" when missing.
   * @returns The new layer.
   */
  layerCreate(name?: string): LayerDefinition {
    const command = new CommandLayerCreate(this.layerManager, name);
    this.commandPushIfChanged(command);
    return command.definitionRead();
  }

  /**
   * Removes a layer other than the default; its objects join the default layer.
   *
   * @param layerIdentifier Layer to remove.
   * @returns True when removed.
   */
  layerRemove(layerIdentifier: string): boolean {
    return this.commandPushIfChanged(new CommandLayerRemove(this.layerManager, layerIdentifier));
  }

  /**
   * Renames a layer other than the default.
   *
   * @param layerIdentifier Layer to rename.
   * @param name New non-blank name.
   * @returns True when renamed.
   */
  layerRename(layerIdentifier: string, name: string): boolean {
    return this.commandPushIfChanged(new CommandLayerRename(this.layerManager, layerIdentifier, name));
  }

  /**
   * Moves a layer one step up or down the list.
   *
   * @param layerIdentifier Layer to move.
   * @param direction -1 for up, 1 for down.
   * @returns True when moved.
   */
  layerMove(layerIdentifier: string, direction: LayerMoveDirection): boolean {
    return this.commandPushIfChanged(new CommandLayerMove(this.layerManager, layerIdentifier, direction));
  }

  /**
   * Sets several switches of a layer as one undoable edit.
   *
   * @param layerIdentifier Layer to change.
   * @param flags Switches and their new values.
   * @returns True when at least one switch changed.
   */
  layerFlagsSet(layerIdentifier: string, flags: Partial<Record<LayerFlagName, boolean>>): boolean {
    const commands = LAYER_FLAG_NAMES.filter((flag) => typeof flags[flag] === 'boolean').map(
      (flag) => new CommandLayerFlagSet(this.layerManager, layerIdentifier, flag, flags[flag] === true),
    );
    return this.commandsPushAsBatch(commands);
  }

  /**
   * Flips one switch of a layer.
   *
   * @param layerIdentifier Layer to change.
   * @param flag Switch to flip.
   * @returns True when the switch changed.
   */
  layerFlagToggle(layerIdentifier: string, flag: LayerFlagName): boolean {
    const definition = this.layerManager.layerFind(layerIdentifier);
    return definition !== null && this.layerFlagsSet(layerIdentifier, { [flag]: !definition[flag] });
  }

  /**
   * Moves objects into a layer; nested objects move with their top-level
   * ancestor.
   *
   * @param objects Objects to move.
   * @param layerIdentifier Target layer.
   * @returns The top-level objects that were moved, empty when nothing changed.
   */
  objectsMoveToLayer(objects: readonly THREE.Object3D[], layerIdentifier: string): THREE.Object3D[] {
    const command = new CommandLayerObjectsMove(this.layerManager, objects, layerIdentifier);
    return this.commandPushIfChanged(command) ? command.objectsRead() : [];
  }

  /**
   * Shows one layer and hides every other layer as one undoable edit.
   *
   * @param layerIdentifier Layer to keep visible.
   * @returns True when any layer changed.
   */
  layerIsolate(layerIdentifier: string): boolean {
    if (this.layerManager.layerFind(layerIdentifier) === null) {
      return false;
    }
    const commands = this.layerManager
      .layersList()
      .map((definition) => this.hiddenSetCommand(definition, definition.id !== layerIdentifier));
    return this.commandsPushAsBatch(commands);
  }

  /**
   * Shows every layer as one undoable edit.
   *
   * @returns True when any layer was hidden.
   */
  layersShowAll(): boolean {
    const commands = this.layerManager.layersList().map((definition) => this.hiddenSetCommand(definition, false));
    return this.commandsPushAsBatch(commands);
  }

  /**
   * Makes a layer the one new objects join. Not undoable.
   *
   * @param layerIdentifier Layer to make current.
   * @returns True when the layer exists.
   */
  currentLayerSet(layerIdentifier: string): boolean {
    const isKnown = this.layerManager.currentLayerSet(layerIdentifier);
    if (isKnown) {
      this.refresh();
    }
    return isKnown;
  }

  /**
   * Creates the command that sets whether a layer is hidden.
   *
   * @param definition Layer to change.
   * @param hidden New hidden state.
   * @returns Flag command.
   */
  private hiddenSetCommand(definition: LayerDefinition, hidden: boolean): CommandLayerFlagSet {
    return new CommandLayerFlagSet(this.layerManager, definition.id, 'hidden', hidden);
  }

  /**
   * Pushes the commands that have an effect as one undo step.
   *
   * @param commands Candidate commands.
   * @returns True when at least one command was pushed.
   */
  private commandsPushAsBatch(commands: readonly CommandLayer[]): boolean {
    const effectiveCommands = commands.filter((command) => command.hasChanges());
    if (effectiveCommands.length === 0) {
      return false;
    }
    const single = effectiveCommands.length === 1 ? effectiveCommands[0] : undefined;
    this.commandStack.push(single ?? new CommandUndoBatch(effectiveCommands));
    this.refresh();
    return true;
  }

  /**
   * Pushes a command when it has an effect and refreshes the editor.
   *
   * @param command Candidate command.
   * @returns True when the command was pushed.
   */
  private commandPushIfChanged(command: CommandLayer): boolean {
    return this.commandsPushAsBatch([command]);
  }
}
