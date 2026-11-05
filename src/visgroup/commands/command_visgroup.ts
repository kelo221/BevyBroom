import type { UndoCommand } from '@/commands/command_undo.js';
import type { VisGroupStore } from '../visgroup_store.js';

/** Base of the undoable VisGroup commands: each one changes one VisGroup store. */
export abstract class CommandVisGroup implements UndoCommand {
  protected readonly store: VisGroupStore;

  /**
   * Creates a VisGroup command.
   *
   * @param store VisGroup store the command changes.
   */
  constructor(store: VisGroupStore) {
    this.store = store;
  }

  /** Applies the command. */
  abstract execute(): void;

  /** Reverts the command. */
  abstract undo(): void;
}
