/**
 * Tracks whether any pointer button is held anywhere in a window, so geometry
 * is published only after a drag or edit gesture ends.
 */
export class PreviewLinkPointerTracker {
  private readonly heldPointers = new Set<number>();
  private readonly target: Window;
  private readonly onPointerDown = (event: PointerEvent): void => {
    this.heldPointers.add(event.pointerId);
  };
  private readonly onPointerRelease = (event: PointerEvent): void => {
    this.heldPointers.delete(event.pointerId);
  };
  private readonly onBlur = (): void => {
    this.heldPointers.clear();
  };

  /**
   * Starts tracking pointers of a window.
   *
   * @param target Window whose pointer events are observed.
   */
  constructor(target: Window) {
    this.target = target;
    target.addEventListener('pointerdown', this.onPointerDown, true);
    target.addEventListener('pointerup', this.onPointerRelease, true);
    target.addEventListener('pointercancel', this.onPointerRelease, true);
    target.addEventListener('blur', this.onBlur);
  }

  /**
   * Returns whether a pointer button is held.
   *
   * @returns True while at least one pointer is pressed.
   */
  isPointerHeld(): boolean {
    return this.heldPointers.size > 0;
  }

  /** Stops tracking and removes every listener. */
  dispose(): void {
    this.target.removeEventListener('pointerdown', this.onPointerDown, true);
    this.target.removeEventListener('pointerup', this.onPointerRelease, true);
    this.target.removeEventListener('pointercancel', this.onPointerRelease, true);
    this.target.removeEventListener('blur', this.onBlur);
    this.heldPointers.clear();
  }
}
