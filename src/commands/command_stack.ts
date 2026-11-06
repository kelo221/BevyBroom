import { UndoCommand } from './command_undo.js';

/**
 * Callback invoked when the command stack state changes.
 *
 * @param undoCount The number of commands available for undo.
 * @param redoCount The number of commands available for redo.
 */
export type CommandStackChangedCallback = (undoCount: number, redoCount: number) => void;

/**
 * Callback invoked right before an executed command becomes the newest undo
 * entry.
 *
 * @param command Command about to be recorded.
 */
export type CommandStackRecordBeforeListener = (command: UndoCommand) => void;

/**
 * Manages the history of undoable commands. Supports undo, redo, stack size
 * limiting, and an undo delegate that takes over undo and redo while set.
 */
export class CommandStack {
  private undoStack: UndoCommand[];
  private redoStack: UndoCommand[];
  private maxSize: number;
  private changedCallbacks: CommandStackChangedCallback[];
  private recordBeforeListeners: CommandStackRecordBeforeListener[];
  private undoDelegate: CommandStack | null;
  private readonly undoDelegateChangedForward: CommandStackChangedCallback;
  private undoTrimmedTotal: number;

  /**
   * Creates a new command stack with a maximum history size.
   *
   * @param maxSize The maximum number of commands to retain in the undo stack.
   */
  constructor(maxSize: number) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxSize = maxSize;
    this.changedCallbacks = [];
    this.recordBeforeListeners = [];
    this.undoDelegate = null;
    this.undoDelegateChangedForward = () => this.notifyChanged();
    this.undoTrimmedTotal = 0;
  }

  /**
   * Drops, with dispose, any pending redo entries, executes the command and
   * records it as the newest undo entry. When execute throws, the redo entries
   * are already gone and nothing is recorded. Drops the oldest command if the
   * stack exceeds the maximum size; dropped undo entries are not disposed
   * because their scene effects remain live.
   *
   * @param command The command to push and execute.
   */
  push(command: UndoCommand): void {
    this.redoStackDiscard();
    command.execute();
    this.undoEntryAppend(command);
  }

  /**
   * Records a command that already ran execute() successfully, dropping any
   * pending redo entries. Used when the caller must validate success before
   * committing history.
   *
   * @param command Already-executed undoable command.
   */
  recordExecuted(command: UndoCommand): void {
    this.redoStackDiscard();
    this.undoEntryAppend(command);
  }

  /**
   * Hands undo and redo to another stack, or takes them back. While a delegate
   * is set, undo, redo and their checks act on the delegate and its changes
   * notify this stack's callbacks.
   *
   * @param delegate Stack that takes over undo and redo, or null to end it.
   */
  undoDelegateSet(delegate: CommandStack | null): void {
    this.undoDelegate?.offStackChanged(this.undoDelegateChangedForward);
    this.undoDelegate = delegate;
    this.undoDelegate?.onStackChanged(this.undoDelegateChangedForward);
    this.notifyChanged();
  }

  /**
   * Registers a listener called right before each recorded entry is added,
   * after a pushed command executed.
   *
   * @param listener Listener receiving the command being recorded.
   * @returns Function that removes the listener.
   */
  recordBeforeListenerAdd(listener: CommandStackRecordBeforeListener): () => void {
    this.recordBeforeListeners.push(listener);
    return () => {
      this.recordBeforeListeners = this.recordBeforeListeners.filter((candidate) => candidate !== listener);
    };
  }

  /**
   * Undoes the most recent command, on the undo delegate while one is set.
   *
   * @returns True if a command was undone.
   */
  undo(): boolean {
    if (this.undoDelegate) {
      return this.undoDelegate.undo();
    }
    const command = this.undoStack.pop();
    if (!command) {
      return false;
    }
    command.undo();
    this.redoStack.push(command);
    this.notifyChanged();
    return true;
  }

  /**
   * Redoes the most recently undone command, on the undo delegate while one is
   * set.
   *
   * @returns True if a command was redone.
   */
  redo(): boolean {
    if (this.undoDelegate) {
      return this.undoDelegate.redo();
    }
    const command = this.redoStack.pop();
    if (!command) {
      return false;
    }
    command.execute();
    this.undoStack.push(command);
    this.notifyChanged();
    return true;
  }

  /**
   * Checks whether undo can run, on the undo delegate while one is set.
   *
   * @returns True if a command may be undone.
   */
  canUndo(): boolean {
    return this.undoAvailableCount() > 0;
  }

  /**
   * Checks whether redo can run, on the undo delegate while one is set.
   *
   * @returns True if a command may be redone.
   */
  canRedo(): boolean {
    return this.redoAvailableCount() > 0;
  }

  /**
   * Returns how many commands undo can reach, counted on the undo delegate
   * while one is set.
   *
   * @returns Number of commands undo may undo.
   */
  undoAvailableCount(): number {
    return this.undoDelegate ? this.undoDelegate.undoAvailableCount() : this.undoStack.length;
  }

  /**
   * Returns how many commands redo can reach, counted on the undo delegate
   * while one is set.
   *
   * @returns Number of commands redo may redo.
   */
  redoAvailableCount(): number {
    return this.undoDelegate ? this.undoDelegate.redoAvailableCount() : this.redoStack.length;
  }

  /**
   * Returns the number of entries on this stack's own undo stack.
   *
   * @returns The undo stack length.
   */
  getUndoCount(): number {
    return this.undoStack.length;
  }

  /**
   * Returns the number of entries on this stack's own redo stack.
   *
   * @returns The redo stack length.
   */
  getRedoCount(): number {
    return this.redoStack.length;
  }

  /**
   * Returns how many of the oldest undo entries were dropped by the size limit
   * since the stack was created.
   *
   * @returns Total number of trimmed undo entries.
   */
  undoTrimmedTotalRead(): number {
    return this.undoTrimmedTotal;
  }

  /**
   * Registers a callback to be invoked whenever the stack changes.
   *
   * @param callback The function to call on stack changes.
   */
  onStackChanged(callback: CommandStackChangedCallback): void {
    this.changedCallbacks.push(callback);
  }

  /**
   * Unregisters a previously registered stack change callback.
   *
   * @param callback The function to remove from callbacks.
   */
  offStackChanged(callback: CommandStackChangedCallback): void {
    const index = this.changedCallbacks.indexOf(callback);
    if (index !== -1) {
      this.changedCallbacks.splice(index, 1);
    }
  }

  /** Notifies all registered callbacks of a stack change. */
  notifyChanged(): void {
    this.changedCallbacks.forEach((callback) => {
      callback(this.getUndoCount(), this.getRedoCount());
    });
  }

  /**
   * Removes the top undo command if it is the given instance, without undoing
   * it. Used to drop a live-edited color command that ended as a no-op.
   *
   * @param command The command that must be the current top of the undo stack.
   * @returns True when the command was removed.
   */
  discardTopIf(command: UndoCommand): boolean {
    if (this.undoStack.length === 0) return false;
    if (this.undoStack[this.undoStack.length - 1] !== command) return false;
    this.undoStack.pop();
    this.notifyChanged();
    return true;
  }

  /**
   * Returns the command currently at the top of the undo stack.
   *
   * @returns The top command, or null when the stack is empty.
   */
  peekUndo(): UndoCommand | null {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1] ?? null;
  }

  /**
   * Removes every undo entry without undoing it and drops, with dispose, every
   * redo entry.
   *
   * @returns Removed undo entries in execution order.
   */
  undoEntriesTake(): UndoCommand[] {
    const undoEntries = this.undoStack;
    this.undoStack = [];
    this.redoStackDiscard();
    this.notifyChanged();
    return undoEntries;
  }

  /**
   * Clears all commands from both stacks without undoing them. Disposes redo
   * commands (their effects are already reversed and may hold orphaned GPU
   * resources). Undo entries are dropped without dispose because their scene
   * effects may still be live (or already disposed by a scene load). Does not
   * call undo — used after scene load when history must be abandoned.
   */
  clear(): void {
    this.disposeCommandList(this.redoStack);
    this.undoStack = [];
    this.redoStack = [];
    this.notifyChanged();
  }

  /**
   * Disposes the command stack by releasing orphaned redo resources and
   * callbacks.
   */
  dispose(): void {
    this.undoDelegateSet(null);
    this.disposeCommandList(this.redoStack);
    this.undoStack = [];
    this.redoStack = [];
    this.changedCallbacks = [];
    this.recordBeforeListeners = [];
  }

  /**
   * Tells the record listeners about a command, adds it as the newest undo
   * entry, applies the size limit and notifies the change callbacks.
   *
   * @param command Executed command to record.
   */
  private undoEntryAppend(command: UndoCommand): void {
    this.recordBeforeListeners.slice().forEach((listener) => listener(command));
    this.undoStack.push(command);
    this.undoStackTrimToMaxSize();
    this.notifyChanged();
  }

  /** Drops and disposes every pending redo entry. */
  private redoStackDiscard(): void {
    if (this.redoStack.length === 0) {
      return;
    }
    this.disposeCommandList(this.redoStack);
    this.redoStack = [];
  }

  /** Drops the oldest undo entries while the stack exceeds the maximum size. */
  private undoStackTrimToMaxSize(): void {
    while (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
      this.undoTrimmedTotal += 1;
    }
  }

  /**
   * Invokes dispose on each command that implements it.
   *
   * @param commands Commands being permanently dropped from history.
   */
  private disposeCommandList(commands: UndoCommand[]): void {
    commands.forEach((command) => {
      if (typeof command.dispose === 'function') {
        command.dispose();
      }
    });
  }
}
