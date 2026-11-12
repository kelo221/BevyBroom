import { describe, expect, it } from 'vitest';
import { platformKeyboardKeyMapCreate } from '@/platform/keyboard/platform_keyboard_key_map_current.js';
import { platformKeyboardShortcutEquals } from '@/platform/keyboard/platform_keyboard_key_map_mac.js';
import type { KeyboardShortcut } from '@/settings/store/settings_types.js';

/**
 * Builds a shortcut binding on a key with the given modifiers.
 *
 * @param code Keyboard event code.
 * @param modifiers Modifiers to switch on.
 * @returns Shortcut binding.
 */
function shortcutCreate(code: string, modifiers: Partial<KeyboardShortcut> = {}): KeyboardShortcut {
  return { code, ctrl: false, shift: false, alt: false, meta: false, ...modifiers };
}

describe('platform keyboard key maps', () => {
  it('gives the forward delete key the Mac delete key with and without Command as aliases', () => {
    const macMap = platformKeyboardKeyMapCreate('mac');
    const aliases = macMap.shortcutAliases(shortcutCreate('Delete'));
    expect(aliases).toEqual([shortcutCreate('Backspace'), shortcutCreate('Backspace', { ctrl: true })]);
    expect(macMap.shortcutBindings(shortcutCreate('Delete'))).toEqual([shortcutCreate('Delete'), ...aliases]);
  });

  it('keeps the configured modifiers on the aliases and drops aliases equal to each other', () => {
    const macMap = platformKeyboardKeyMapCreate('mac');
    const shiftDelete = shortcutCreate('Delete', { shift: true });
    expect(macMap.shortcutAliases(shiftDelete)).toEqual([
      shortcutCreate('Backspace', { shift: true }),
      shortcutCreate('Backspace', { shift: true, ctrl: true }),
    ]);
    const commandDelete = shortcutCreate('Delete', { ctrl: true });
    expect(macMap.shortcutAliases(commandDelete)).toEqual([shortcutCreate('Backspace', { ctrl: true })]);
  });

  it('lets Option+arrow stand in for the page keys on Mac', () => {
    const macMap = platformKeyboardKeyMapCreate('mac');
    expect(macMap.shortcutAliases(shortcutCreate('PageUp'))).toEqual([shortcutCreate('ArrowUp', { alt: true })]);
    expect(macMap.shortcutAliases(shortcutCreate('PageDown'))).toEqual([shortcutCreate('ArrowDown', { alt: true })]);
  });

  it('adds no aliases to keys every keyboard has, and none at all on Windows and Linux', () => {
    const macMap = platformKeyboardKeyMapCreate('mac');
    expect(macMap.shortcutAliases(shortcutCreate('KeyS', { ctrl: true }))).toEqual([]);
    expect(macMap.shortcutAliases(shortcutCreate('Backspace'))).toEqual([]);
    for (const platform of ['windows', 'linux', 'other'] as const) {
      const standardMap = platformKeyboardKeyMapCreate(platform);
      expect(standardMap.shortcutAliases(shortcutCreate('Delete'))).toEqual([]);
      expect(standardMap.shortcutAliases(shortcutCreate('PageUp'))).toEqual([]);
      expect(standardMap.shortcutBindings(shortcutCreate('Delete'))).toEqual([shortcutCreate('Delete')]);
    }
  });

  it('labels keys with Mac menu glyphs on Mac and short words elsewhere', () => {
    const macMap = platformKeyboardKeyMapCreate('mac');
    const windowsMap = platformKeyboardKeyMapCreate('windows');
    expect(macMap.keyLabel('Backspace')).toBe('⌫');
    expect(macMap.keyLabel('Delete')).toBe('⌦');
    expect(macMap.keyLabel('Escape')).toBe('⎋');
    expect(macMap.keyLabel('Enter')).toBe('↩');
    expect(macMap.keyLabel('PageUp')).toBe('⇞');
    expect(macMap.keyLabel('ArrowLeft')).toBe('←');
    expect(windowsMap.keyLabel('Backspace')).toBe('Backspace');
    expect(windowsMap.keyLabel('Delete')).toBe('Del');
    expect(windowsMap.keyLabel('Escape')).toBe('Esc');
    expect(windowsMap.keyLabel('PageUp')).toBe('PageUp');
  });

  it('labels letters, digits and the backquote the same way on every platform', () => {
    for (const platform of ['mac', 'windows', 'linux'] as const) {
      const keyMap = platformKeyboardKeyMapCreate(platform);
      expect(keyMap.keyLabel('KeyS')).toBe('S');
      expect(keyMap.keyLabel('Digit4')).toBe('4');
      expect(keyMap.keyLabel('Backquote')).toBe('`');
      expect(keyMap.keyLabel('F5')).toBe('F5');
    }
  });

  it('compares bindings by key and every modifier', () => {
    expect(platformKeyboardShortcutEquals(shortcutCreate('KeyA'), shortcutCreate('KeyA'))).toBe(true);
    expect(platformKeyboardShortcutEquals(shortcutCreate('KeyA'), shortcutCreate('KeyA', { meta: true }))).toBe(false);
    expect(platformKeyboardShortcutEquals(shortcutCreate('KeyA'), shortcutCreate('KeyB'))).toBe(false);
  });
});
