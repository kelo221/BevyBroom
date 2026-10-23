import { describe, it, expect } from 'vitest';
import { EditorSettingsStore } from '@/settings/store/editor_settings_store.js';
import {
  createDefaultKeyboardShortcutSettings,
  createDefaultViewSettings,
} from '@/settings/store/settings_defaults.js';
import { mergeViewSettings } from '@/settings/store/settings_value_sanitizers.js';
import type { KeyboardShortcut } from '@/settings/store/settings_types.js';
import { MemorySettingsStorage } from '@/settings/storage/settings_storage.js';

describe('face UV editor settings', () => {
  it('defaults the Face inspector auto-reveal to on', () => {
    expect(createDefaultViewSettings().faceInspectorAutoReveal).toBe(true);
    expect(new EditorSettingsStore(new MemorySettingsStorage()).getViewSettings().faceInspectorAutoReveal).toBe(true);
  });

  it('persists and reloads the auto-reveal preference', () => {
    const storage = new MemorySettingsStorage();
    const store = new EditorSettingsStore(storage);
    store.setFaceInspectorAutoReveal(false);
    const reloaded = new EditorSettingsStore(storage);
    expect(reloaded.getViewSettings().faceInspectorAutoReveal).toBe(false);
  });

  it('falls back to the default when the stored value is invalid', () => {
    const merged = mergeViewSettings(createDefaultViewSettings(), JSON.stringify({ faceInspectorAutoReveal: 'yes' }));
    expect(merged.faceInspectorAutoReveal).toBe(true);
  });

  it('binds the face UV shortcut defaults without modifier conflicts with existing actions', () => {
    const shortcuts = createDefaultKeyboardShortcutSettings();
    expect(shortcuts.face_uv_nudge_left.code).toBe('ArrowLeft');
    expect(shortcuts.face_uv_nudge_up.code).toBe('ArrowUp');
    expect(shortcuts.face_uv_rotate_ccw).toEqual({
      code: 'PageUp',
      ctrl: false,
      shift: false,
      alt: false,
      meta: false,
    });
    expect(shortcuts.face_uv_flip_h).toEqual({ code: 'KeyF', ctrl: true, shift: false, alt: false, meta: false });
    expect(shortcuts.face_uv_flip_v).toEqual({ code: 'KeyF', ctrl: true, shift: false, alt: true, meta: false });
    expect(shortcuts.face_uv_reset_face).toEqual({ code: 'KeyR', ctrl: false, shift: true, alt: false, meta: false });
    expect(shortcuts.face_uv_reset_world).toEqual({ code: 'KeyR', ctrl: false, shift: true, alt: true, meta: false });
    expectFaceUvBindingsUnique(shortcuts);
  });
});

/**
 * Asserts no face UV shortcut shares its key and modifiers with any other
 * configured action.
 *
 * @param shortcuts Complete shortcut settings.
 */
function expectFaceUvBindingsUnique(shortcuts: ReturnType<typeof createDefaultKeyboardShortcutSettings>): void {
  const entries = Object.entries(shortcuts) as Array<[string, KeyboardShortcut]>;
  const bindingKey = (shortcut: KeyboardShortcut): string =>
    `${shortcut.code}|${shortcut.ctrl}|${shortcut.shift}|${shortcut.alt}|${shortcut.meta}`;
  const otherBindings = new Set(
    entries.filter(([action]) => !action.startsWith('face_uv_')).map(([, shortcut]) => bindingKey(shortcut)),
  );
  entries
    .filter(([action]) => action.startsWith('face_uv_'))
    .forEach(([, shortcut]) => {
      expect(otherBindings.has(bindingKey(shortcut))).toBe(false);
    });
}
