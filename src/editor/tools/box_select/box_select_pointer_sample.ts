import type { EditorWindow } from '@/editor/window/editor_window.js';
import { isAltPressedOnDomFlags } from '@/input/modifier_keys_query.js';
import type { ObjectDragPointerSample } from '@/tools/object_drag/object_drag_pointer_sample.js';

/** Modifier key codes paired with the sample flag they control. */
const BOX_SELECT_MODIFIER_KEY_FLAGS: Readonly<Record<string, 'shiftKey' | 'ctrlKey' | 'altKey'>> = {
  ShiftLeft: 'shiftKey',
  ShiftRight: 'shiftKey',
  ControlLeft: 'ctrlKey',
  ControlRight: 'ctrlKey',
  MetaLeft: 'ctrlKey',
  MetaRight: 'ctrlKey',
  AltLeft: 'altKey',
  AltRight: 'altKey',
};

/**
 * Reads the editor's last pointer position and current modifier keys.
 *
 * @param editor Editor window holding the pointer sample.
 * @returns Pointer sample.
 */
export function boxSelectPointerSampleRead(editor: EditorWindow): ObjectDragPointerSample {
  return {
    clientX: editor.lastPointerClientX,
    clientY: editor.lastPointerClientY,
    shiftKey: editor.isShiftPressed,
    ctrlKey: editor.isCtrlPressed,
    altKey: boxSelectAltPressedRead(editor),
  };
}

/**
 * Reads whether Alt is held from latched pointer flags or the input managers.
 *
 * @param editor Editor window.
 * @returns True while Alt is held.
 */
function boxSelectAltPressedRead(editor: EditorWindow): boolean {
  const latchedFlags = editor.getLatchedModifierFlags();
  if (latchedFlags && isAltPressedOnDomFlags(latchedFlags)) {
    return true;
  }
  return editor.getServices()?.isAltPressed() === true;
}

/**
 * Returns whether a key code is a Shift, Ctrl, Meta or Alt key.
 *
 * @param keyCode Key code string.
 * @returns True for modifier keys.
 */
export function boxSelectModifierKeyIs(keyCode: string): boolean {
  return BOX_SELECT_MODIFIER_KEY_FLAGS[keyCode] !== undefined;
}

/**
 * Copies a sample with the modifier of a released key cleared.
 *
 * @param sample Sample read before the release took effect.
 * @param releasedKeyCode Key code of the released key.
 * @returns New sample.
 */
export function boxSelectPointerSampleWithKeyReleased(
  sample: ObjectDragPointerSample,
  releasedKeyCode: string,
): ObjectDragPointerSample {
  const releasedFlag = BOX_SELECT_MODIFIER_KEY_FLAGS[releasedKeyCode];
  if (!releasedFlag) {
    return { ...sample };
  }
  return { ...sample, [releasedFlag]: false };
}
