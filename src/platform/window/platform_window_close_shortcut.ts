import type { PlatformKeyboardModifierMap } from '@/platform/keyboard/platform_keyboard_modifier_map.js';
import { keyboardEventMatchesCode } from '@/input/keyboard_event_match.js';
import { handlerKeyboardShortcutIsTypingTarget } from '@/input/handler_keyboard_shortcut_types.js';

/** Keyboard event code of the close window key. */
export const PLATFORM_WINDOW_CLOSE_SHORTCUT_CODE = 'KeyW';

/**
 * Closes the topmost open floating window.
 *
 * @returns True when a window was closed.
 */
export type PlatformWindowCloseTopmost = () => boolean;

/**
 * Closes the topmost floating window or dialog on the system close window
 * shortcut (primary modifier + W), the way macOS closes the front window.
 * Presses inside text fields and presses that close nothing are left to the
 * browser.
 */
export class PlatformWindowCloseShortcut {
  private readonly modifierMap: PlatformKeyboardModifierMap;
  private readonly closeTopmost: PlatformWindowCloseTopmost;
  private readonly listener: (event: KeyboardEvent) => void;
  private readonly windows = new Set<Window>();

  /**
   * Creates the shortcut without listening yet.
   *
   * @param modifierMap Modifier map telling the primary modifier.
   * @param closeTopmost Closes the topmost open floating window.
   */
  constructor(modifierMap: PlatformKeyboardModifierMap, closeTopmost: PlatformWindowCloseTopmost) {
    this.modifierMap = modifierMap;
    this.closeTopmost = closeTopmost;
    this.listener = (event) => this.keyDownHandle(event);
  }

  /**
   * Listens for the shortcut in a window. Safe to call repeatedly for the same
   * window.
   *
   * @param targetWindow Window whose key presses are watched.
   */
  installOnWindow(targetWindow: Window): void {
    if (this.windows.has(targetWindow)) {
      return;
    }
    this.windows.add(targetWindow);
    targetWindow.addEventListener('keydown', this.listener, { capture: true });
  }

  /**
   * Stops listening in a window.
   *
   * @param targetWindow Window that no longer watches the shortcut.
   */
  uninstallFromWindow(targetWindow: Window): void {
    if (this.windows.delete(targetWindow)) {
      targetWindow.removeEventListener('keydown', this.listener, { capture: true });
    }
  }

  /** Stops listening in every window. */
  dispose(): void {
    for (const targetWindow of [...this.windows]) {
      this.uninstallFromWindow(targetWindow);
    }
  }

  /**
   * Returns whether a key press is the close window shortcut: the close key
   * with the primary modifier and no other modifier.
   *
   * @param event Keyboard event.
   * @returns True for the close window shortcut.
   */
  shortcutIs(event: KeyboardEvent): boolean {
    if (!keyboardEventMatchesCode(event, PLATFORM_WINDOW_CLOSE_SHORTCUT_CODE)) {
      return false;
    }
    return (
      this.modifierMap.primaryDown(event) && !this.modifierMap.secondaryDown(event) && !event.shiftKey && !event.altKey
    );
  }

  /**
   * Closes the topmost floating window on the shortcut and claims the event
   * when one closed.
   *
   * @param event Keyboard event seen first on the window.
   */
  private keyDownHandle(event: KeyboardEvent): void {
    if (event.repeat || !this.shortcutIs(event) || handlerKeyboardShortcutIsTypingTarget(event.target)) {
      return;
    }
    if (this.closeTopmost()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
}
