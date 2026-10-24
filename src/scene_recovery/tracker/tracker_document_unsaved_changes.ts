import type { CommandStack } from '@/commands/command_stack.js';
import type { UndoCommand } from '@/commands/command_undo.js';

/** Called when the document switches between saved and unsaved. */
export type TrackerDocumentUnsavedChangesCallback = (hasUnsavedChanges: boolean) => void;

/** Saved point that no history state matches, for documents never saved. */
const TRACKER_SAVED_POINT_UNREACHABLE = Symbol('saved_point_unreachable');

/**
 * Tells whether the document differs from its last saved state by comparing the
 * newest undoable command with the one that was newest when the document was
 * saved. Undoing back to the saved point makes the document saved again.
 */
export class TrackerDocumentUnsavedChanges {
  private readonly commandStack: CommandStack;
  private readonly callbacks: TrackerDocumentUnsavedChangesCallback[] = [];
  private savedPointCommand: UndoCommand | null | typeof TRACKER_SAVED_POINT_UNREACHABLE;
  private wasUnsaved = false;
  private readonly stackChangedListener = (): void => this.unsavedStateNotifyWhenChanged();

  /**
   * Starts tracking with the current history counted as saved.
   *
   * @param commandStack History of the document.
   */
  constructor(commandStack: CommandStack) {
    this.commandStack = commandStack;
    this.savedPointCommand = commandStack.peekUndo();
    commandStack.onStackChanged(this.stackChangedListener);
  }

  /**
   * Returns whether the document has changes that are not saved.
   *
   * @returns True when the history differs from the saved point.
   */
  hasUnsavedChanges(): boolean {
    return this.commandStack.peekUndo() !== this.savedPointCommand;
  }

  /** Counts the current history as saved. */
  savedPointMark(): void {
    this.savedPointCommand = this.commandStack.peekUndo();
    this.unsavedStateNotifyWhenChanged();
  }

  /** Counts the document as unsaved until it is saved, whatever is undone. */
  savedPointForget(): void {
    this.savedPointCommand = TRACKER_SAVED_POINT_UNREACHABLE;
    this.unsavedStateNotifyWhenChanged();
  }

  /**
   * Registers a callback for switches between saved and unsaved.
   *
   * @param callback Called with the new state.
   */
  onUnsavedChangesChanged(callback: TrackerDocumentUnsavedChangesCallback): void {
    this.callbacks.push(callback);
  }

  /** Stops listening to the history. */
  dispose(): void {
    this.commandStack.offStackChanged(this.stackChangedListener);
    this.callbacks.length = 0;
  }

  /**
   * Calls the callbacks when the saved state differs from the last one
   * reported.
   */
  private unsavedStateNotifyWhenChanged(): void {
    const isUnsaved = this.hasUnsavedChanges();
    if (isUnsaved === this.wasUnsaved) {
      return;
    }
    this.wasUnsaved = isUnsaved;
    this.callbacks.forEach((callback) => callback(isUnsaved));
  }
}
