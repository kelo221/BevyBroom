import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { platformIsMac } from '@/platform/platform_kind.js';
import { editorApiModifierKeysRead, type EditorApiViewportKeys } from './editor_api_viewport_pointer.js';

/** Key values of the non-character keys keyboard_input names by code. */
const EDITOR_API_KEYBOARD_INPUT_NAMED_KEYS: Readonly<Record<string, string>> = {
  Space: ' ',
  Enter: 'Enter',
  Escape: 'Escape',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
};

/**
 * Drives the keyboard like a user: presses a key with modifiers on the focused
 * element, or types text into the focused text field, through real keyboard and
 * input events so the editor's own shortcut and field handling reacts.
 */
export class EditorApiKeyboardInput {
  private readonly ownerDocument: Document;

  /**
   * Creates the keyboard tools.
   *
   * @param ownerDocument Document whose focused element receives the input.
   */
  constructor(ownerDocument: Document = document) {
    this.ownerDocument = ownerDocument;
  }

  /**
   * Runs a keyboard tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no keyboard tool.
   */
  keyboardInputToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    if (name !== 'keyboard_input') {
      return null;
    }
    const code = args['code'];
    const text = args['text'];
    if ((code === undefined) === (text === undefined)) {
      return failResult('Give exactly one of code or text');
    }
    if (typeof text === 'string') {
      return this.textType(text);
    }
    return typeof code === 'string' && code !== ''
      ? this.keyPress(code, args['keys'])
      : failResult('code must be a key code');
  }

  /**
   * Presses and releases one key with modifiers on the focused element.
   *
   * @param code Keyboard event code, such as KeyP or Enter.
   * @param keysValue Optional modifier keys argument.
   * @returns Result naming the focused element afterwards.
   */
  private keyPress(code: string, keysValue: unknown): McpToolResult {
    const keys = editorApiModifierKeysRead(keysValue);
    if (!keys) {
      return failResult('keys must be an object with optional ctrl, shift and alt booleans');
    }
    const target = this.focusedElementRead();
    const keydown = this.keyboardEventCreate('keydown', code, keys);
    target.dispatchEvent(keydown);
    target.dispatchEvent(this.keyboardEventCreate('keyup', code, keys));
    return okResult(`Pressed ${code}`, {
      handled: keydown.defaultPrevented,
      focused: this.focusedElementDescribe(),
    });
  }

  /**
   * Types text into the focused text field at its caret.
   *
   * @param text Text to type.
   * @returns Result with the field's value afterwards.
   */
  private textType(text: string): McpToolResult {
    const field = this.ownerDocument.activeElement;
    if (!(field instanceof HTMLInputElement) && !(field instanceof HTMLTextAreaElement)) {
      return failResult('No text field has keyboard focus');
    }
    const caretStart = field.selectionStart ?? field.value.length;
    const caretEnd = field.selectionEnd ?? field.value.length;
    field.setRangeText(text, caretStart, caretEnd, 'end');
    field.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
    return okResult('Typed text', { value: field.value, focused: this.focusedElementDescribe() });
  }

  /**
   * Creates a keyboard event as a user's key press produces it. Ctrl means the
   * primary shortcut modifier: Control, or Command on macOS.
   *
   * @param type Event type.
   * @param code Keyboard event code.
   * @param keys Held modifier keys.
   * @returns Keyboard event.
   */
  private keyboardEventCreate(type: string, code: string, keys: EditorApiViewportKeys): KeyboardEvent {
    const isMac = platformIsMac();
    return new KeyboardEvent(type, {
      code,
      key: this.keyValueOfCode(code, keys.shift),
      bubbles: true,
      cancelable: true,
      ctrlKey: keys.ctrl && !isMac,
      metaKey: keys.ctrl && isMac,
      shiftKey: keys.shift,
      altKey: keys.alt,
    });
  }

  /**
   * Returns the key value a US layout gives a key code.
   *
   * @param code Keyboard event code.
   * @param isShiftHeld True while Shift is held.
   * @returns Key value.
   */
  private keyValueOfCode(code: string, isShiftHeld: boolean): string {
    if (/^Key[A-Z]$/.test(code)) {
      const letter = code.slice(3);
      return isShiftHeld ? letter : letter.toLowerCase();
    }
    if (/^Digit[0-9]$/.test(code)) {
      return code.slice(5);
    }
    return EDITOR_API_KEYBOARD_INPUT_NAMED_KEYS[code] ?? code;
  }

  /**
   * Returns the element that has keyboard focus, or the body when none has.
   *
   * @returns Focused element.
   */
  private focusedElementRead(): Element {
    return this.ownerDocument.activeElement ?? this.ownerDocument.body;
  }

  /**
   * Describes the focused element for the tool result.
   *
   * @returns Tag name and accessible label of the focused element.
   */
  private focusedElementDescribe(): { tag: string; label: string | null } {
    const focused = this.focusedElementRead();
    return { tag: focused.tagName.toLowerCase(), label: focused.getAttribute('aria-label') };
  }
}
