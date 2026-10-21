import type { EditorServices } from '@/editor/window/editor_services.js';
import { pointerDragThresholdExceeded } from '@/input/pointer_drag_threshold.js';
import type { ObjectDragPointerSample } from '@/tools/object_drag/object_drag_pointer_sample.js';
import type { ObjectDragSession } from '@/tools/object_drag/object_drag_session.js';

/**
 * Tells a left-button click from a drag for the object tool. A press that moves
 * past the drag threshold starts the object drag the press implies and
 * suppresses the click; a press released in place stays a click.
 */
export class BoxSelectDragGesture {
  private pressSample: ObjectDragPointerSample | null = null;
  private dragStarted = false;
  private clickSuppressed = false;
  private session: ObjectDragSession | null = null;

  /**
   * Returns whether an object drag session is running.
   *
   * @returns True while a session receives pointer samples.
   */
  isSessionActive(): boolean {
    return this.session !== null;
  }

  /**
   * Records a left-button press.
   *
   * @param sample Press position and modifier keys.
   */
  pressBegin(sample: ObjectDragPointerSample): void {
    this.sessionCancel();
    this.pressSample = { ...sample };
    this.dragStarted = false;
    this.clickSuppressed = false;
  }

  /**
   * Handles pointer movement with the left button held: starts the drag once
   * the pointer leaves the threshold and feeds a running session.
   *
   * @param sample Current pointer position and modifier keys.
   * @param services Editor services that start object drags.
   */
  pointerMoved(sample: ObjectDragPointerSample, services: EditorServices | null): void {
    if (this.session) {
      this.session.update(sample);
      return;
    }
    const press = this.pressSample;
    if (!press || this.dragStarted) {
      return;
    }
    if (!pointerDragThresholdExceeded(press.clientX, press.clientY, sample.clientX, sample.clientY)) {
      return;
    }
    this.dragStarted = true;
    this.session = services?.beginObjectDragAtClientPoint?.(press) ?? null;
    this.session?.update(sample);
  }

  /**
   * Re-applies the current pointer position after a modifier key changed.
   *
   * @param sample Current pointer position and modifier keys.
   */
  modifiersChanged(sample: ObjectDragPointerSample): void {
    this.session?.update(sample);
  }

  /**
   * Ends the press: commits a running session and reports whether the release
   * counts as a click.
   *
   * @returns True when click selection should run.
   */
  release(): boolean {
    const clickAllowed = !this.dragStarted && !this.clickSuppressed;
    const session = this.session;
    this.session = null;
    session?.commit();
    this.pressSample = null;
    this.dragStarted = false;
    this.clickSuppressed = false;
    return clickAllowed;
  }

  /**
   * Cancels a running session and keeps the coming release from clicking.
   *
   * @returns True when a session was cancelled.
   */
  cancelActiveSession(): boolean {
    if (!this.session) {
      return false;
    }
    this.sessionCancel();
    this.clickSuppressed = true;
    return true;
  }

  /** Cancels any running session and forgets the press. */
  reset(): void {
    this.sessionCancel();
    this.pressSample = null;
    this.dragStarted = false;
    this.clickSuppressed = false;
  }

  /** Cancels the running session, if any. */
  private sessionCancel(): void {
    const session = this.session;
    this.session = null;
    session?.cancel();
  }
}
