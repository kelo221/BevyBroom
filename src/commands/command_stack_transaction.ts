import type { CommandStack } from './command_stack.js';
import type { UndoCommand } from './command_undo.js';
import { CommandUndoBatch } from './command_undo_batch.js';

/**
 * Groups every command pushed onto a command stack after it began into one
 * history entry, or removes them again. The transaction remembers the undo
 * depth at its start and lowers it by the entries the size limit trimmed since,
 * so entries recorded before it began are never taken.
 */
export class CommandStackTransaction {
  private readonly commandStack: CommandStack;
  private readonly undoDepthAtBegin: number;
  private readonly undoTrimmedTotalAtBegin: number;

  /**
   * Begins a transaction on a command stack.
   *
   * @param commandStack Stack whose new entries this transaction owns.
   */
  constructor(commandStack: CommandStack) {
    this.commandStack = commandStack;
    this.undoDepthAtBegin = commandStack.getUndoCount();
    this.undoTrimmedTotalAtBegin = commandStack.undoTrimmedTotalRead();
  }

  /**
   * Replaces every entry pushed since the transaction began with one batch
   * entry. A single entry stays as it is.
   *
   * @returns Number of commands that now form the transaction entry.
   */
  commit(): number {
    const commands = this.commandsSinceBeginDetach();
    if (commands.length === 1) {
      this.commandStack.recordExecuted(commands[0] as UndoCommand);
    }
    if (commands.length > 1) {
      this.commandStack.recordExecuted(CommandUndoBatch.fromExecuted(commands));
    }
    return commands.length;
  }

  /**
   * Undoes and drops every entry pushed since the transaction began, newest
   * first, without leaving redo entries behind.
   *
   * @returns Number of commands that were undone.
   */
  rollback(): number {
    const commands = this.commandsSinceBeginDetach();
    for (let index = commands.length - 1; index >= 0; index--) {
      this.commandUndoAndDispose(commands[index] as UndoCommand);
    }
    return commands.length;
  }

  /**
   * Returns how many undo entries were recorded since the transaction began.
   * Entries the size limit trimmed lower the start depth; entries undone below
   * the start depth leave nothing to take.
   *
   * @returns Number of entries owned by the transaction.
   */
  private commandCountSinceBegin(): number {
    const trimmedSinceBegin = this.commandStack.undoTrimmedTotalRead() - this.undoTrimmedTotalAtBegin;
    const startDepth = Math.max(0, this.undoDepthAtBegin - trimmedSinceBegin);
    return Math.max(0, this.commandStack.getUndoCount() - startDepth);
  }

  /**
   * Removes the entries pushed since the transaction began from the undo stack.
   *
   * @returns Removed commands in execution order.
   */
  private commandsSinceBeginDetach(): UndoCommand[] {
    const commands: UndoCommand[] = [];
    for (let remaining = this.commandCountSinceBegin(); remaining > 0; remaining--) {
      const top = this.commandStack.peekUndo();
      if (!top || !this.commandStack.discardTopIf(top)) {
        break;
      }
      commands.unshift(top);
    }
    return commands;
  }

  /**
   * Undoes one detached command and releases its resources.
   *
   * @param command Command removed from history.
   */
  private commandUndoAndDispose(command: UndoCommand): void {
    command.undo();
    command.dispose?.();
  }
}
