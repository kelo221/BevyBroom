import type { ToolbarMenuTextEditCommand } from '@/ui/menu/menu_types.js';
import { handlerKeyboardShortcutIsTypingTarget } from '@/input/handler_keyboard_shortcut_types.js';

/**
 * Runs a text editing command on the focused text field when one has keyboard
 * focus.
 *
 * @param command Text editing command.
 * @param targetDocument Document whose focused element receives the command.
 * @returns True when a text field had focus and received the command.
 */
export function nativeMenuTextEditRun(command: ToolbarMenuTextEditCommand, targetDocument: Document): boolean {
  if (!handlerKeyboardShortcutIsTypingTarget(targetDocument.activeElement)) {
    return false;
  }
  targetDocument.execCommand(command);
  return true;
}
