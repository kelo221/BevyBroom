import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { UndoCommand } from '@/commands/command_undo.js';
import { CommandUndoBatch } from '@/commands/command_undo_batch.js';
import { CommandObjectHierarchyDelete } from '@/outliner/commands/command_object_hierarchy_delete.js';
import { CommandPrimitiveCreate } from '@/tools/creation/commands/command_primitive_create.js';
import { SprinkleMark } from '@/tools/sprinkle/mark/sprinkle_mark.js';
import type { SprinkleStrokeResult } from './sprinkle_stroke_types.js';

/**
 * Scene changes of one stroke: adds and removes entities right away through
 * undoable commands, tracks the sprinkled entities currently in the world and
 * records all changes as one undo step when the stroke finishes.
 */
export class SprinkleStrokeEdits {
  private readonly commands: UndoCommand[] = [];
  private readonly addedByStroke = new Set<THREE.Object3D>();
  private readonly sprinkledLive: Set<THREE.Object3D>;
  private addedCount = 0;
  private removedCount = 0;

  /**
   * Starts tracking the sprinkled entities under a world root.
   *
   * @param worldObject World root new entities are added under.
   */
  constructor(private readonly worldObject: THREE.Object3D) {
    this.sprinkledLive = new Set(SprinkleMark.objectsCollect(worldObject));
  }

  /**
   * Adds an entity under the world root.
   *
   * @param entity New sprinkled entity.
   */
  entityAdd(entity: THREE.Object3D): void {
    this.commandRun(new CommandPrimitiveCreate(entity, this.worldObject));
    this.addedByStroke.add(entity);
    this.sprinkledLive.add(entity);
    this.addedCount += 1;
  }

  /**
   * Removes a sprinkled entity from its parent; entities already removed are
   * left alone.
   *
   * @param entity Sprinkled entity in the world.
   */
  entityRemove(entity: THREE.Object3D): void {
    if (!this.sprinkledLive.has(entity)) {
      return;
    }
    this.commandRun(new CommandObjectHierarchyDelete([entity]));
    this.sprinkledLive.delete(entity);
    this.removedCount += 1;
  }

  /**
   * Returns the sprinkled entities currently in the world.
   *
   * @returns Sprinkled entities.
   */
  sprinkledLiveRead(): readonly THREE.Object3D[] {
    return [...this.sprinkledLive];
  }

  /**
   * Returns whether this stroke placed an entity.
   *
   * @param entity Sprinkled entity.
   * @returns True for entities the stroke added.
   */
  isAddedByStroke(entity: THREE.Object3D): boolean {
    return this.addedByStroke.has(entity);
  }

  /**
   * Returns the counts of the changes so far.
   *
   * @returns Entities added and removed.
   */
  resultRead(): SprinkleStrokeResult {
    return { added: this.addedCount, removed: this.removedCount };
  }

  /**
   * Records every change as one undo step; records nothing without changes.
   *
   * @param commandStack Undo stack.
   */
  commit(commandStack: CommandStack): void {
    if (this.commands.length > 0) {
      commandStack.recordExecuted(CommandUndoBatch.fromExecuted(this.commands.splice(0)));
    }
  }

  /**
   * Executes a command and keeps it for the undo step.
   *
   * @param command Command to run.
   */
  private commandRun(command: UndoCommand): void {
    command.execute();
    this.commands.push(command);
  }
}
