import { describe, expect, it, vi } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import type { UndoCommand } from '@/commands/command_undo.js';
import { ObjectPropertiesSession } from '@/ui/object_properties/session/object_properties_session.js';

/** Command that adds an amount to a shared counter and records disposal. */
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

/** Editor stack, counter, session and rollback spy of one session test. */
interface SessionTestRig {
  readonly editorStack: CommandStack;
  readonly counter: { value: number };
  readonly session: ObjectPropertiesSession;
  readonly sessionStack: CommandStack;
  readonly afterRollback: ReturnType<typeof vi.fn>;
}

/**
 * Creates an editor stack with one older entry, a counter and a session over
 * them.
 *
 * @returns Test rig.
 */
function sessionRigCreate(): SessionTestRig {
  const editorStack = new CommandStack(32);
  const counter = { value: 0 };
  editorStack.push(new CommandCounterAdd(counter, 1));
  const afterRollback = vi.fn();
  const session = new ObjectPropertiesSession(editorStack, afterRollback);
  return { editorStack, counter, session, sessionStack: session.commandStackRead(), afterRollback };
}

/**
 * The Object Properties session keeps its edits as one history entry on apply,
 * removes them without history on cancel, keeps undo inside its own edits while
 * it runs and lets commands recorded by other parts of the editor land on top
 * of the edits made so far.
 */
describe('ObjectPropertiesSession', () => {
  it('applies several edits as one history entry', () => {
    const { editorStack, counter, session, sessionStack } = sessionRigCreate();
    const undoCountBefore = editorStack.getUndoCount();
    session.begin();
    sessionStack.push(new CommandCounterAdd(counter, 10));
    sessionStack.push(new CommandCounterAdd(counter, 100));
    expect(editorStack.getUndoCount()).toBe(undoCountBefore);
    expect(session.apply()).toBe(2);
    expect(session.isActive()).toBe(false);
    expect(editorStack.getUndoCount()).toBe(undoCountBefore + 1);
    editorStack.undo();
    expect(counter.value).toBe(1);
  });

  it('cancels edits without changing the history and refreshes the editor', () => {
    const { editorStack, counter, session, sessionStack, afterRollback } = sessionRigCreate();
    const undoCountBefore = editorStack.getUndoCount();
    const valueBefore = counter.value;
    session.begin();
    const edit = new CommandCounterAdd(counter, 10);
    sessionStack.push(edit);
    expect(session.cancel()).toBe(1);
    expect(counter.value).toBe(valueBefore);
    expect(edit.isDisposed).toBe(true);
    expect(editorStack.getUndoCount()).toBe(undoCountBefore);
    expect(editorStack.canRedo()).toBe(false);
    expect(afterRollback).toHaveBeenCalledOnce();
  });

  it('keeps editor undo inside the session and gives it back when it ends', () => {
    const { editorStack, counter, session, sessionStack } = sessionRigCreate();
    const valueBefore = counter.value;
    session.begin();
    sessionStack.push(new CommandCounterAdd(counter, 10));
    expect(editorStack.undo()).toBe(true);
    expect(editorStack.undo()).toBe(false);
    expect(counter.value).toBe(valueBefore);
    session.cancel();
    expect(editorStack.canRedo()).toBe(false);
    expect(editorStack.canUndo()).toBe(true);
  });

  it('adds nothing when applied without edits and ignores repeated ends', () => {
    const { editorStack, session, afterRollback } = sessionRigCreate();
    const undoCountBefore = editorStack.getUndoCount();
    session.begin();
    expect(session.apply()).toBe(0);
    expect(session.apply()).toBe(0);
    expect(session.cancel()).toBe(0);
    expect(editorStack.getUndoCount()).toBe(undoCountBefore);
    expect(afterRollback).not.toHaveBeenCalled();
  });

  it('applies nothing after every edit was undone and disposes the undone edits', () => {
    const { editorStack, counter, session, sessionStack } = sessionRigCreate();
    const undoCountBefore = editorStack.getUndoCount();
    const valueBefore = counter.value;
    session.begin();
    const edits = [new CommandCounterAdd(counter, 10), new CommandCounterAdd(counter, 100)];
    edits.forEach((edit) => sessionStack.push(edit));
    while (editorStack.undo()) {
      expect(session.isActive()).toBe(true);
    }
    expect(session.apply()).toBe(0);
    expect(edits.every((edit) => edit.isDisposed)).toBe(true);
    expect(counter.value).toBe(valueBefore);
    expect(editorStack.getUndoCount()).toBe(undoCountBefore);
    expect(editorStack.canRedo()).toBe(false);
  });

  it('applies an edit that was undone and redone inside the session', () => {
    const { editorStack, counter, session, sessionStack } = sessionRigCreate();
    const undoCountBefore = editorStack.getUndoCount();
    session.begin();
    const edit = new CommandCounterAdd(counter, 10);
    sessionStack.push(edit);
    const valueEdited = counter.value;
    editorStack.undo();
    expect(editorStack.redo()).toBe(true);
    expect(session.apply()).toBe(1);
    expect(counter.value).toBe(valueEdited);
    expect(editorStack.peekUndo()).toBe(edit);
    expect(editorStack.getUndoCount()).toBe(undoCountBefore + 1);
  });

  it('keeps editor undo inside the session after an edit was discarded', () => {
    const { editorStack, counter, session, sessionStack } = sessionRigCreate();
    const valueBefore = counter.value;
    session.begin();
    const edit = new CommandCounterAdd(counter, 10);
    sessionStack.push(edit);
    sessionStack.discardTopIf(edit);
    expect(editorStack.canUndo()).toBe(false);
    expect(editorStack.undo()).toBe(false);
    expect(counter.value).toBe(valueBefore + 10);
    session.cancel();
    expect(editorStack.canUndo()).toBe(true);
  });

  it('records the edits so far below a command another part of the editor records, then cancels only later edits', () => {
    const { editorStack, counter, session, sessionStack } = sessionRigCreate();
    const undoCountBefore = editorStack.getUndoCount();
    session.begin();
    sessionStack.push(new CommandCounterAdd(counter, 10));
    sessionStack.push(new CommandCounterAdd(counter, 100));
    const foreign = new CommandCounterAdd(counter, 1000);
    editorStack.push(foreign);
    expect(session.isActive()).toBe(true);
    expect(editorStack.getUndoCount()).toBe(undoCountBefore + 2);
    expect(editorStack.peekUndo()).toBe(foreign);
    const valueAfterForeign = counter.value;
    sessionStack.push(new CommandCounterAdd(counter, 5));
    expect(session.cancel()).toBe(1);
    expect(counter.value).toBe(valueAfterForeign);
    editorStack.undo();
    expect(counter.value).toBe(valueAfterForeign - 1000);
    editorStack.undo();
    expect(counter.value).toBe(1);
  });

  it('applies one entry above a command another part of the editor recorded', () => {
    const { editorStack, counter, session, sessionStack } = sessionRigCreate();
    const undoCountBefore = editorStack.getUndoCount();
    session.begin();
    sessionStack.push(new CommandCounterAdd(counter, 10));
    const foreign = new CommandCounterAdd(counter, 1000);
    editorStack.push(foreign);
    const lastEdits = [new CommandCounterAdd(counter, 100), new CommandCounterAdd(counter, 200)];
    lastEdits.forEach((edit) => sessionStack.push(edit));
    expect(session.apply()).toBe(lastEdits.length);
    expect(editorStack.getUndoCount()).toBe(undoCountBefore + 3);
    editorStack.undo();
    expect(editorStack.peekUndo()).toBe(foreign);
  });

  it('records nothing extra for a foreign command when the session has no edits', () => {
    const { editorStack, counter, session } = sessionRigCreate();
    const undoCountBefore = editorStack.getUndoCount();
    session.begin();
    editorStack.push(new CommandCounterAdd(counter, 1000));
    expect(editorStack.getUndoCount()).toBe(undoCountBefore + 1);
    expect(session.apply()).toBe(0);
  });
});
