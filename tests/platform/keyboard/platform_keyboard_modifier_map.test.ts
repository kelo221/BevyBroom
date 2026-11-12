import { describe, expect, it } from 'vitest';
import { platformKeyboardModifierMapCreate } from '@/platform/keyboard/platform_keyboard_modifier_map_current.js';
import type { KeyboardShortcut } from '@/settings/store/settings_types.js';

/**
 * Builds a shortcut binding with the given modifiers.
 *
 * @param modifiers Modifiers to switch on.
 * @returns Shortcut binding on the S key.
 */
function shortcutCreate(modifiers: Partial<KeyboardShortcut>): KeyboardShortcut {
  return { code: 'KeyS', ctrl: false, shift: false, alt: false, meta: false, ...modifiers };
}

describe('platform keyboard modifier maps', () => {
  it('treats Command as the primary modifier on macOS and Control elsewhere', () => {
    const commandFlags = { ctrlKey: false, metaKey: true };
    const controlFlags = { ctrlKey: true, metaKey: false };
    const macMap = platformKeyboardModifierMapCreate('mac');
    const windowsMap = platformKeyboardModifierMapCreate('windows');
    expect(macMap.primaryDown(commandFlags)).toBe(true);
    expect(macMap.secondaryDown(controlFlags)).toBe(true);
    expect(windowsMap.primaryDown(controlFlags)).toBe(true);
    expect(windowsMap.secondaryDown(commandFlags)).toBe(true);
  });

  it('ignores tracked Control keys on macOS because Command swallows key releases', () => {
    const tracker = { isCtrlDown: () => true };
    expect(platformKeyboardModifierMapCreate('mac').primaryTrackedDown(tracker)).toBe(false);
    expect(platformKeyboardModifierMapCreate('linux').primaryTrackedDown(tracker)).toBe(true);
  });

  it('labels the same binding with macOS symbols in system order and Windows words', () => {
    const shortcut = shortcutCreate({ ctrl: true, shift: true, alt: true });
    expect(platformKeyboardModifierMapCreate('mac').labelFormat(shortcut, 'S')).toBe('⌥⇧⌘S');
    expect(platformKeyboardModifierMapCreate('windows').labelFormat(shortcut, 'S')).toBe('Ctrl+Shift+Alt+S');
  });
});
