import type { ObjectDragPointerSample } from './object_drag_pointer_sample.js';

/**
 * Base class for one viewport mouse drag that edits objects (moving the
 * selection or drawing a new shape). A session receives pointer samples until
 * it is committed or cancelled exactly once; later calls are ignored.
 */
export abstract class ObjectDragSession {
  private sessionFinished = false;

  /**
   * Returns whether the session was already committed or cancelled.
   *
   * @returns True once the session has finished.
   */
  isFinished(): boolean {
    return this.sessionFinished;
  }

  /**
   * Feeds a new pointer sample to a running session.
   *
   * @param sample Current pointer position and modifier keys.
   */
  update(sample: ObjectDragPointerSample): void {
    if (this.sessionFinished) {
      return;
    }
    this.sessionUpdate(sample);
  }

  /** Applies the session result (one undo entry) and finishes the session. */
  commit(): void {
    if (this.sessionFinished) {
      return;
    }
    this.sessionFinished = true;
    this.sessionCommit();
  }

  /** Reverts every live change of the session and finishes it. */
  cancel(): void {
    if (this.sessionFinished) {
      return;
    }
    this.sessionFinished = true;
    this.sessionCancel();
  }

  /**
   * Updates live state for a pointer sample.
   *
   * @param sample Current pointer position and modifier keys.
   */
  protected abstract sessionUpdate(sample: ObjectDragPointerSample): void;

  /** Applies the final result of the session. */
  protected abstract sessionCommit(): void;

  /** Reverts all live changes of the session. */
  protected abstract sessionCancel(): void;
}
