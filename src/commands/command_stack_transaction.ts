import type { CommandStack } from './command_stack.js';
import type { UndoCommand } from './command_undo.js';
import { CommandUndoBatch } from './command_undo_batch.js';

/**
 * Groups every command pushed onto a command stack after it began into one
 * history entry, or removes them again. Commands are identified by the undo
 * entry that was on top when the transaction began.
 */
export class CommandStackTransaction {
  private readonly commandStack: CommandStack;
  private readonly topCommandAtBegin: UndoCommand | null;

  /**
   * Begins a transaction on a command stack.
   *
   * @param commandStack Stack whose new entries this transaction owns.
   */
  constructor(commandStack: CommandStack) {
    this.commandStack = commandStack;
    this.topCommandAtBegin = commandStack.peekUndo();
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
   * Removes the entries pushed since the transaction began from the undo stack.
   *
   * @returns Removed commands in execution order.
   */
  private commandsSinceBeginDetach(): UndoCommand[] {
    const commands: UndoCommand[] = [];
    let top = this.commandStack.peekUndo();
    while (top !== null && top !== this.topCommandAtBegin) {
      this.commandStack.discardTopIf(top);
      commands.unshift(top);
      top = this.commandStack.peekUndo();
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
