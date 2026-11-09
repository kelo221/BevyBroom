/** Pointer button index to its bit in `PointerEvent.buttons`. */
const EDITOR_INPUT_BUTTON_BITS: Readonly<Record<number, number>> = { 0: 1, 1: 4, 2: 2, 3: 8, 4: 16 };

/**
 * Remembers which pointer buttons the browser last reported as held, so a busy
 * state left by a lost release can be told apart from a press that is still
 * held.
 */
export class EditorInputHeldButtons {
  private heldButtonsMask = 0;

  /**
   * Stores the held-buttons bitfield of a pointer event.
   *
   * @param event Pointer event seen by the editor.
   */
  record(event: PointerEvent): void {
    this.heldButtonsMask = event.buttons;
  }

  /**
   * Returns whether the last pointer event reported any held button.
   *
   * @returns True while at least one button was down at the last sample.
   */
  isAnyHeld(): boolean {
    return this.heldButtonsMask !== 0;
  }

  /**
   * Returns whether a pointer event shows a button held other than the one it
   * pressed.
   *
   * @param event Pointer down event.
   * @returns True when an earlier press is still held.
   */
  static isOtherButtonHeld(event: PointerEvent): boolean {
    const pressedBit = EDITOR_INPUT_BUTTON_BITS[event.button] ?? 0;
    return (event.buttons & ~pressedBit) !== 0;
  }
}
