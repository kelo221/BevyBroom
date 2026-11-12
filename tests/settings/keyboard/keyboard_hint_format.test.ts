import { describe, expect, it } from 'vitest';
import { keyboardHintFormat } from '@/settings/keyboard/keyboard_hint_format.js';
import { platformKeyboardModifierMapCreate } from '@/platform/keyboard/platform_keyboard_modifier_map_current.js';
import { platformKeyboardKeyMapCreate } from '@/platform/keyboard/platform_keyboard_key_map_current.js';

describe('keyboardHintFormat', () => {
  it('writes modifier placeholders as words on Windows and Linux and as symbols on macOS', () => {
    const template = '{ctrl}+click toggles, {shift}+click adds, {alt}+wheel resizes, {meta} is spare';
    for (const platform of ['windows', 'linux'] as const) {
      const formatted = keyboardHintFormat(
        template,
        platformKeyboardModifierMapCreate(platform),
        platformKeyboardKeyMapCreate(platform),
      );
      expect(formatted).toBe('Ctrl+click toggles, Shift+click adds, Alt+wheel resizes, Meta is spare');
    }
    expect(
      keyboardHintFormat(template, platformKeyboardModifierMapCreate('mac'), platformKeyboardKeyMapCreate('mac')),
    ).toBe('⌘+click toggles, ⇧+click adds, ⌥+wheel resizes, ⌃ is spare');
  });

  it('names the physical Control key Ctrl on Windows and ⌃ on macOS', () => {
    const template = 'hold {control} to erase';
    expect(
      keyboardHintFormat(
        template,
        platformKeyboardModifierMapCreate('windows'),
        platformKeyboardKeyMapCreate('windows'),
      ),
    ).toBe('hold Ctrl to erase');
    expect(
      keyboardHintFormat(template, platformKeyboardModifierMapCreate('mac'), platformKeyboardKeyMapCreate('mac')),
    ).toBe('hold ⌃ to erase');
  });

  it('fills short key labels and sentence key names from the key map', () => {
    const template = 'Dissolve ({key:Delete}); {keyname:Delete} dissolves, {keyname:Backspace} deletes';
    expect(
      keyboardHintFormat(
        template,
        platformKeyboardModifierMapCreate('windows'),
        platformKeyboardKeyMapCreate('windows'),
      ),
    ).toBe('Dissolve (Del); Delete dissolves, Backspace deletes');
    expect(
      keyboardHintFormat(template, platformKeyboardModifierMapCreate('mac'), platformKeyboardKeyMapCreate('mac')),
    ).toBe('Dissolve (⌦); ⌦ dissolves, ⌫ deletes');
  });

  it('leaves text without placeholders and unknown placeholders untouched', () => {
    const text = 'LMB drag paints, {unknown} stays, G / R / S transform';
    expect(
      keyboardHintFormat(text, platformKeyboardModifierMapCreate('mac'), platformKeyboardKeyMapCreate('mac')),
    ).toBe(text);
  });

  it('uses the maps of the current platform by default', () => {
    expect(keyboardHintFormat('{ctrl}+R')).toMatch(/^(Ctrl|⌘)\+R$/);
  });
});
