import { CommandStack } from '@/commands/command_stack.js';
import { CommandStackTransaction } from '@/commands/command_stack_transaction.js';
import type { UndoCommand } from '@/commands/command_undo.js';
import { CommandUndoBatch } from '@/commands/command_undo_batch.js';

/**
 * Edit session of the Object Properties dialog. The dialog pushes its edits
 * onto the session's own command stack so they show live while the editor's
 * history keeps only finished entries. While active, undo and redo of the
 * editor stack act on the session's edits. Applying records them on the editor
 * stack as one entry; cancelling undoes them without leaving history. A command
 * that another part of the editor records while the session is active first
 * records the session's edits as one entry, so it lands on top of them and the
 * session continues with no edits.
 */
export class ObjectPropertiesSession {
  private readonly editorCommandStack: CommandStack;
  private readonly sessionCommandStack: CommandStack;
  private readonly afterRollback: () => void;
  private sessionTransaction: CommandStackTransaction | null;
  private editorRecordListenerRemove: (() => void) | null;
  private isRecordingSessionEdits: boolean;

  /**
   * Creates an inactive session.
   *
   * @param editorCommandStack Editor history the applied edits are recorded on.
   * @param afterRollback Called after cancel undid at least one edit, to
   *   refresh the editor.
   */
  constructor(editorCommandStack: CommandStack, afterRollback: () => void) {
    this.editorCommandStack = editorCommandStack;
    this.sessionCommandStack = new CommandStack(Number.POSITIVE_INFINITY);
    this.afterRollback = afterRollback;
    this.sessionTransaction = null;
    this.editorRecordListenerRemove = null;
    this.isRecordingSessionEdits = false;
  }

  /**
   * Returns the stack the dialog pushes its edits onto.
   *
   * @returns Session command stack.
   */
  commandStackRead(): CommandStack {
    return this.sessionCommandStack;
  }

  /**
   * Returns whether the session is active.
   *
   * @returns True between begin and apply or cancel.
   */
  isActive(): boolean {
    return this.sessionTransaction !== null;
  }

  /** Starts the session with no edits; does nothing while active. */
  begin(): void {
    if (this.sessionTransaction) {
      return;
    }
    this.sessionTransaction = new CommandStackTransaction(this.sessionCommandStack);
    this.editorCommandStack.undoDelegateSet(this.sessionCommandStack);
    this.editorRecordListenerRemove = this.editorCommandStack.recordBeforeListenerAdd(() =>
      this.editorRecordBeforeHandle(),
    );
  }

  /**
   * Ends the session, recording its edits on the editor stack as one entry.
   * Undone edits are dropped.
   *
   * @returns Number of edits in the entry, zero when nothing changed or the
   *   session was not active.
   */
  apply(): number {
    if (!this.isActive()) {
      return 0;
    }
    const recordedCount = this.sessionEditsRecordOnEditorStack();
    this.end();
    return recordedCount;
  }

  /**
   * Ends the session, undoing its edits without adding history.
   *
   * @returns Number of edits undone, zero when the session was not active.
   */
  cancel(): number {
    const transaction = this.sessionTransaction;
    if (!transaction) {
      return 0;
    }
    const undoneCount = transaction.rollback();
    this.end();
    if (undoneCount > 0) {
      this.afterRollback();
    }
    return undoneCount;
  }

  /**
   * Records the session's edits first when another part of the editor records a
   * command on the editor stack.
   */
  private editorRecordBeforeHandle(): void {
    if (!this.isRecordingSessionEdits) {
      this.sessionEditsRecordOnEditorStack();
    }
  }

  /**
   * Moves the session's edits onto the editor stack as one entry and drops the
   * undone ones.
   *
   * @returns Number of edits recorded.
   */
  private sessionEditsRecordOnEditorStack(): number {
    const edits = this.sessionCommandStack.undoEntriesTake();
    const entry = ObjectPropertiesSession.historyEntryCreate(edits);
    if (!entry) {
      return 0;
    }
    this.isRecordingSessionEdits = true;
    try {
      this.editorCommandStack.recordExecuted(entry);
    } finally {
      this.isRecordingSessionEdits = false;
    }
    return edits.length;
  }

  /** Hands undo back to the editor stack and drops what the session kept. */
  private end(): void {
    this.editorRecordListenerRemove?.();
    this.editorRecordListenerRemove = null;
    this.sessionTransaction = null;
    this.editorCommandStack.undoDelegateSet(null);
    this.sessionCommandStack.clear();
  }

  /**
   * Creates the history entry for executed edits: the edit itself when there is
   * one, else a batch.
   *
   * @param edits Executed edits in order.
   * @returns History entry, or null without edits.
   */
  private static historyEntryCreate(edits: readonly UndoCommand[]): UndoCommand | null {
    if (edits.length <= 1) {
      return edits[0] ?? null;
    }
    return CommandUndoBatch.fromExecuted(edits);
  }
}
