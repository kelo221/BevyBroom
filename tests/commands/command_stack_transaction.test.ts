import { describe, expect, it } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import type { UndoCommand } from '@/commands/command_undo.js';
import { CommandStackTransaction } from '@/commands/command_stack_transaction.js';

/** Command that adds a value to a shared counter and records disposal. */
class CommandCounterAdd implements UndoCommand {
  isDisposed = false;

  /**
   * Creates a counter command.
   *
   * @param counter Shared counter box.
   * @param counter.value Current counter value.
   * @param amount Amount added on execute and removed on undo.
   */
  constructor(
    private readonly counter: { value: number },
    private readonly amount: number,
  ) {}

  /** Adds the amount. */
  execute(): void {
    this.counter.value += this.amount;
  }

  /** Removes the amount. */
  undo(): void {
    this.counter.value -= this.amount;
  }

  /** Marks the command disposed. */
  dispose(): void {
    this.isDisposed = true;
  }
}

/**
 * Proves CommandStackTransaction squashes everything pushed after it began into
 * one undo entry, and that rollback undoes exactly those commands.
 */
describe('CommandStackTransaction', () => {
  it('commits several pushed commands as one undo entry and leaves earlier entries alone', () => {
    const counter = { value: 0 };
    const stack = new CommandStack(32);
    stack.push(new CommandCounterAdd(counter, 1));
    const undoCountBefore = stack.getUndoCount();
    const transaction = new CommandStackTransaction(stack);
    stack.push(new CommandCounterAdd(counter, 10));
    stack.push(new CommandCounterAdd(counter, 100));
    expect(transaction.commit()).toBe(2);
    expect(stack.getUndoCount()).toBe(undoCountBefore + 1);
    stack.undo();
    expect(counter.value).toBe(1);
    stack.redo();
    expect(counter.value).toBe(111);
  });

  it('keeps a single pushed command as it is', () => {
    const counter = { value: 0 };
    const stack = new CommandStack(32);
    const transaction = new CommandStackTransaction(stack);
    const onlyCommand = new CommandCounterAdd(counter, 5);
    stack.push(onlyCommand);
    expect(transaction.commit()).toBe(1);
    expect(stack.peekUndo()).toBe(onlyCommand);
  });

  it('commits nothing when no command was pushed', () => {
    const stack = new CommandStack(32);
    const transaction = new CommandStackTransaction(stack);
    expect(transaction.commit()).toBe(0);
    expect(stack.canUndo()).toBe(false);
  });

  it('rolls back only the commands pushed since it began, without redo entries', () => {
    const counter = { value: 0 };
    const stack = new CommandStack(32);
    stack.push(new CommandCounterAdd(counter, 1));
    const transaction = new CommandStackTransaction(stack);
    const first = new CommandCounterAdd(counter, 10);
    const second = new CommandCounterAdd(counter, 100);
    stack.push(first);
    stack.push(second);
    expect(transaction.rollback()).toBe(2);
    expect(counter.value).toBe(1);
    expect(stack.getUndoCount()).toBe(1);
    expect(stack.canRedo()).toBe(false);
    expect(first.isDisposed && second.isDisposed).toBe(true);
  });

  it('commits only its own commands after the size limit trimmed the entry it began on', () => {
    const counter = { value: 0 };
    const maxSize = 3;
    const stack = new CommandStack(maxSize);
    const earlierCommands = Array.from({ length: maxSize }, () => new CommandCounterAdd(counter, 1));
    earlierCommands.forEach((command) => stack.push(command));
    const transaction = new CommandStackTransaction(stack);
    stack.push(new CommandCounterAdd(counter, 10));
    stack.push(new CommandCounterAdd(counter, 100));
    expect(stack.undoTrimmedTotalRead()).toBeGreaterThan(0);
    expect(transaction.commit()).toBe(2);
    stack.undo();
    expect(counter.value).toBe(maxSize);
    expect(stack.peekUndo()).toBe(earlierCommands[earlierCommands.length - 1]);
  });

  it('rolls back only its own commands after the size limit trimmed the entry it began on', () => {
    const counter = { value: 0 };
    const maxSize = 2;
    const stack = new CommandStack(maxSize);
    const earlierCommands = Array.from({ length: maxSize }, () => new CommandCounterAdd(counter, 1));
    earlierCommands.forEach((command) => stack.push(command));
    const transaction = new CommandStackTransaction(stack);
    stack.push(new CommandCounterAdd(counter, 10));
    expect(transaction.rollback()).toBe(1);
    expect(counter.value).toBe(maxSize);
    expect(stack.peekUndo()).toBe(earlierCommands[earlierCommands.length - 1]);
    expect(stack.getUndoCount()).toBe(maxSize - 1);
  });

  it('takes nothing when the history was undone below the point where it began', () => {
    const counter = { value: 0 };
    const stack = new CommandStack(32);
    stack.push(new CommandCounterAdd(counter, 1));
    stack.push(new CommandCounterAdd(counter, 2));
    const transaction = new CommandStackTransaction(stack);
    stack.undo();
    expect(transaction.rollback()).toBe(0);
    expect(stack.getUndoCount()).toBe(1);
    expect(stack.canRedo()).toBe(true);
  });
});
