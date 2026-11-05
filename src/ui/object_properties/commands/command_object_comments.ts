import type * as THREE from 'three';
import type { UndoCommand } from '@/commands/command_undo.js';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';

/** One object with its comments before the edit. */
interface ObjectCommentsBefore {
  readonly object: THREE.Object3D;
  readonly comments: string;
}

/**
 * Undoable change of the designer comments of one or more objects. Each object
 * keeps its own previous comments, so undo restores them exactly.
 */
export class CommandObjectComments implements UndoCommand {
  private readonly changes: ObjectCommentsBefore[];
  private readonly commentsNext: string;

  /**
   * Captures the current comments of every object whose comments change.
   *
   * @param objects Objects to edit.
   * @param commentsNext Comments every object receives.
   */
  constructor(objects: readonly THREE.Object3D[], commentsNext: string) {
    this.commentsNext = commentsNext;
    this.changes = objects
      .map((object) => ({ object, comments: GameEntityLogicStore.commentsRead(object) }))
      .filter((change) => change.comments !== commentsNext);
  }

  /**
   * Returns whether the command changes any object.
   *
   * @returns True when at least one object's comments differ.
   */
  hasChanges(): boolean {
    return this.changes.length > 0;
  }

  /** Writes the new comments onto every changed object. */
  execute(): void {
    this.changes.forEach((change) => GameEntityLogicStore.commentsWrite(change.object, this.commentsNext));
  }

  /** Restores every changed object's previous comments. */
  undo(): void {
    this.changes.forEach((change) => GameEntityLogicStore.commentsWrite(change.object, change.comments));
  }
}
