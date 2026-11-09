import type { EditorWindow } from './editor_window.js';
import type { EditorInputHeldButtons } from './editor_input_held_buttons.js';

/**
 * Frees the focused event receiver from busy state that only a pointer press
 * justified once that press is known to be over, so a lost release can never
 * keep the exclusive mouse shield over the tool rail and menus.
 */
export class EditorStalePressRelease {
  /**
   * Drops the press-held busy state of the focused receiver and clears the
   * editor's pressed-button flags.
   *
   * @param editor Editor window whose focused receiver is checked.
   * @returns True when the receiver was busy and no longer is.
   */
  static release(editor: EditorWindow): boolean {
    if (!editor.isActiveEventReceiverBusy) {
      return false;
    }
    if (!editor.getActiveEventReceiver().pointerPressHoldRelease()) {
      return false;
    }
    editor.isLeftMousePressed = false;
    editor.isRightMousePressed = false;
    return !editor.isActiveEventReceiverBusy;
  }

  /**
   * Drops press-held busy state only when the last pointer sample held no
   * button, then reports whether the focused receiver is still busy.
   *
   * @param editor Editor window whose focused receiver is checked.
   * @param heldButtons Buttons the browser last reported as held.
   * @returns True while the focused receiver stays busy.
   */
  static busyAfterReleaseWhenNoButtonHeld(editor: EditorWindow, heldButtons: EditorInputHeldButtons): boolean {
    if (!heldButtons.isAnyHeld()) {
      EditorStalePressRelease.release(editor);
    }
    return editor.isActiveEventReceiverBusy;
  }
}
