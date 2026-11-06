import { describe, it, expect, vi } from 'vitest';
import { UndoCommand } from '@/commands/command_undo.js';
import { CommandStack } from '@/commands/command_stack.js';

/** A test command that tracks whether execute/undo was called. */
class TestCommand implements UndoCommand {
  private executeCount = 0;
  private undoCount = 0;
  private readonly tag: string;

  constructor(tag: string) {
    this.tag = tag;
  }

  execute(): void {
    this.executeCount++;
  }

  undo(): void {
    this.undoCount++;
  }

  getExecuteCount(): number {
    return this.executeCount;
  }

  getUndoCount(): number {
    return this.undoCount;
  }

  getTag(): string {
    return this.tag;
  }
}

/** A test command that also tracks dispose calls for resource cleanup. */
class DisposableTestCommand extends TestCommand {
  private disposeCount = 0;

  dispose(): void {
    this.disposeCount++;
  }

  getDisposeCount(): number {
    return this.disposeCount;
  }
}

describe('CommandStack', () => {
  it('should start empty', () => {
    const stack = new CommandStack(64);
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
    expect(stack.getUndoCount()).toBe(0);
    expect(stack.getRedoCount()).toBe(0);
  });

  it('should increment undo count on push', () => {
    const stack = new CommandStack(64);
    const cmd = new TestCommand('cmd1');
    stack.push(cmd);
    expect(stack.getUndoCount()).toBe(1);
    expect(stack.canUndo()).toBe(true);
    expect(cmd.getExecuteCount()).toBe(1);
  });

  it('should decrement undo and increment redo on undo', () => {
    const stack = new CommandStack(64);
    const cmd = new TestCommand('cmd1');
    stack.push(cmd);
    const result = stack.undo();
    expect(result).toBe(true);
    expect(stack.getUndoCount()).toBe(0);
    expect(stack.getRedoCount()).toBe(1);
    expect(cmd.getUndoCount()).toBe(1);
  });

  it('should decrement redo and increment undo on redo', () => {
    const stack = new CommandStack(64);
    const cmd = new TestCommand('cmd1');
    stack.push(cmd);
    stack.undo();
    const result = stack.redo();
    expect(result).toBe(true);
    expect(stack.getUndoCount()).toBe(1);
    expect(stack.getRedoCount()).toBe(0);
    expect(cmd.getExecuteCount()).toBe(2);
  });

  it('should return false when undoing beyond bottom', () => {
    const stack = new CommandStack(64);
    const result = stack.undo();
    expect(result).toBe(false);
    expect(stack.getUndoCount()).toBe(0);
    expect(stack.getRedoCount()).toBe(0);
  });

  it('should return false when redoing beyond top', () => {
    const stack = new CommandStack(64);
    const result = stack.redo();
    expect(result).toBe(false);
    expect(stack.getUndoCount()).toBe(0);
    expect(stack.getRedoCount()).toBe(0);
  });

  it('should discard future stack on new push after partial undo', () => {
    const stack = new CommandStack(64);
    const cmd1 = new TestCommand('cmd1');
    const cmd2 = new TestCommand('cmd2');
    const cmd3 = new TestCommand('cmd3');
    stack.push(cmd1);
    stack.push(cmd2);
    stack.undo();
    expect(stack.getRedoCount()).toBe(1);
    stack.push(cmd3);
    expect(stack.getRedoCount()).toBe(0);
    expect(stack.getUndoCount()).toBe(2);
  });

  it('should drop oldest command when exceeding max capacity', () => {
    const stack = new CommandStack(3);
    stack.push(new TestCommand('a'));
    stack.push(new TestCommand('b'));
    stack.push(new TestCommand('c'));
    expect(stack.getUndoCount()).toBe(3);
    stack.push(new TestCommand('d'));
    expect(stack.getUndoCount()).toBe(3);
  });

  it('should fire callback on push', () => {
    const stack = new CommandStack(64);
    const callback = vi.fn();
    stack.onStackChanged(callback);
    stack.push(new TestCommand('push'));
    expect(callback).toHaveBeenCalledWith(1, 0);
  });

  it('should fire callback on undo', () => {
    const stack = new CommandStack(64);
    const callback = vi.fn();
    stack.onStackChanged(callback);
    stack.push(new TestCommand('push'));
    callback.mockClear();
    stack.undo();
    expect(callback).toHaveBeenCalledWith(0, 1);
  });

  it('should fire callback on redo', () => {
    const stack = new CommandStack(64);
    const callback = vi.fn();
    stack.onStackChanged(callback);
    stack.push(new TestCommand('push'));
    stack.undo();
    callback.mockClear();
    stack.redo();
    expect(callback).toHaveBeenCalledWith(1, 0);
  });

  it('should clear both stacks', () => {
    const stack = new CommandStack(64);
    const callback = vi.fn();
    stack.onStackChanged(callback);
    stack.push(new TestCommand('a'));
    stack.push(new TestCommand('b'));
    stack.undo();
    expect(stack.getUndoCount()).toBe(1);
    expect(stack.getRedoCount()).toBe(1);
    stack.clear();
    expect(stack.getUndoCount()).toBe(0);
    expect(stack.getRedoCount()).toBe(0);
  });

  it('should discard the top undo command by identity without undoing', () => {
    const stack = new CommandStack(64);
    const first = new TestCommand('first');
    const second = new TestCommand('second');
    stack.push(first);
    stack.push(second);
    expect(stack.discardTopIf(first)).toBe(false);
    expect(stack.getUndoCount()).toBe(2);
    expect(stack.discardTopIf(second)).toBe(true);
    expect(stack.getUndoCount()).toBe(1);
    expect(stack.peekUndo()).toBe(first);
    expect(second.getUndoCount()).toBe(0);
  });

  it('should dispose discarded redo commands when redo is cleared', () => {
    const stack = new CommandStack(64);
    const command = new DisposableTestCommand('redo-resource');
    stack.push(command);
    stack.undo();
    expect(stack.getRedoCount()).toBe(1);
    stack.push(new TestCommand('replacement'));
    expect(command.getDisposeCount()).toBe(1);
    expect(stack.getRedoCount()).toBe(0);
  });

  it('should dispose redo commands on clear without undoing', () => {
    const stack = new CommandStack(64);
    const command = new DisposableTestCommand('clear-resource');
    stack.push(command);
    stack.undo();
    expect(command.getUndoCount()).toBe(1);
    stack.clear();
    expect(command.getDisposeCount()).toBe(1);
    expect(command.getUndoCount()).toBe(1);
    expect(stack.getUndoCount()).toBe(0);
    expect(stack.getRedoCount()).toBe(0);
  });

  it('should dispose and clear state', () => {
    const stack = new CommandStack(64);
    const callback = vi.fn();
    stack.onStackChanged(callback);
    stack.push(new TestCommand('a'));
    stack.dispose();
    expect(stack.getUndoCount()).toBe(0);
    expect(stack.getRedoCount()).toBe(0);
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
  });

  it('should allow removing callback with offStackChanged', () => {
    const stack = new CommandStack(64);
    const callback = vi.fn();
    stack.onStackChanged(callback);
    stack.offStackChanged(callback);
    stack.push(new TestCommand('push'));
    expect(callback).not.toHaveBeenCalled();
  });
});

/** Command whose execute always throws. */
class ThrowingTestCommand extends TestCommand {
  /** Throws instead of executing. */
  override execute(): void {
    throw new Error('execute failed');
  }
}

/**
 * Push drops pending redo entries before it executes, so a failing command
 * leaves no redo behind and records nothing.
 */
describe('CommandStack push failure', () => {
  it('disposes redo entries before execute and records nothing when execute throws', () => {
    const stack = new CommandStack(64);
    const undone = new DisposableTestCommand('undone');
    stack.push(new TestCommand('kept'));
    stack.push(undone);
    stack.undo();
    const undoCountBefore = stack.getUndoCount();
    expect(() => stack.push(new ThrowingTestCommand('throws'))).toThrow('execute failed');
    expect(undone.getDisposeCount()).toBe(1);
    expect(stack.canRedo()).toBe(false);
    expect(stack.getUndoCount()).toBe(undoCountBefore);
  });
});

/**
 * An undo delegate takes over undo and redo, so a session can let the user undo
 * its own edits without reaching older history.
 */
describe('CommandStack undo delegate', () => {
  it('undoes and redoes on the delegate while set and on its own entries afterwards', () => {
    const stack = new CommandStack(64);
    const delegate = new CommandStack(64);
    const ownCommand = new TestCommand('own');
    stack.push(ownCommand);
    stack.undoDelegateSet(delegate);
    expect(stack.canUndo()).toBe(false);
    const delegateCommand = new TestCommand('delegate');
    delegate.push(delegateCommand);
    expect(stack.undoAvailableCount()).toBe(1);
    expect(stack.undo()).toBe(true);
    expect(delegateCommand.getUndoCount()).toBe(1);
    expect(stack.undo()).toBe(false);
    expect(stack.redo()).toBe(true);
    expect(delegateCommand.getExecuteCount()).toBe(2);
    expect(ownCommand.getUndoCount()).toBe(0);
    stack.undoDelegateSet(null);
    expect(stack.undo()).toBe(true);
    expect(ownCommand.getUndoCount()).toBe(1);
  });

  it('keeps its redo entries out of reach while the delegate is set', () => {
    const stack = new CommandStack(64);
    stack.push(new TestCommand('undone'));
    stack.undo();
    stack.undoDelegateSet(new CommandStack(64));
    expect(stack.canRedo()).toBe(false);
    expect(stack.redoAvailableCount()).toBe(0);
    expect(stack.getRedoCount()).toBe(1);
  });

  it('notifies its own callbacks about delegate changes until the delegate is removed', () => {
    const stack = new CommandStack(64);
    const delegate = new CommandStack(64);
    const callback = vi.fn();
    stack.onStackChanged(callback);
    stack.undoDelegateSet(delegate);
    callback.mockClear();
    delegate.push(new TestCommand('delegate'));
    expect(callback).toHaveBeenCalled();
    stack.undoDelegateSet(null);
    callback.mockClear();
    delegate.push(new TestCommand('later'));
    expect(callback).not.toHaveBeenCalled();
  });
});

/**
 * Record listeners see each command right before it is added, and taking the
 * entries empties the history.
 */
describe('CommandStack recording', () => {
  it('calls record listeners before the entry is added until removed', () => {
    const stack = new CommandStack(64);
    const command = new TestCommand('recorded');
    const undoCountsSeen: number[] = [];
    const listenerRemove = stack.recordBeforeListenerAdd((recorded) => {
      expect(recorded).toBe(command);
      undoCountsSeen.push(stack.getUndoCount());
    });
    stack.push(command);
    expect(undoCountsSeen).toEqual([0]);
    listenerRemove();
    stack.push(new TestCommand('unseen'));
    expect(undoCountsSeen).toEqual([0]);
  });

  it('takes every undo entry in order without undoing and disposes redo entries', () => {
    const stack = new CommandStack(64);
    const first = new TestCommand('first');
    const second = new TestCommand('second');
    const undone = new DisposableTestCommand('undone');
    [first, second, undone].forEach((command) => stack.push(command));
    stack.undo();
    expect(stack.undoEntriesTake()).toEqual([first, second]);
    expect(first.getUndoCount() + second.getUndoCount()).toBe(0);
    expect(undone.getDisposeCount()).toBe(1);
    expect(stack.canUndo() || stack.canRedo()).toBe(false);
  });

  it('counts the entries the size limit trimmed', () => {
    const maxSize = 2;
    const stack = new CommandStack(maxSize);
    const pushedCount = maxSize + 3;
    for (let index = 0; index < pushedCount; index++) {
      stack.push(new TestCommand(`command_${index}`));
    }
    expect(stack.undoTrimmedTotalRead()).toBe(pushedCount - maxSize);
    expect(stack.getUndoCount()).toBe(maxSize);
  });
});
