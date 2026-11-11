import { describe, it, expect } from 'vitest';
import {
  modifierStackClipboardCopy,
  modifierStackClipboardPaste,
  modifierStackClipboardSettingsCopy,
  modifierStackClipboardSettingsPaste,
} from '@/modifier/stack/clipboard/modifier_stack_clipboard.js';
import {
  MODIFIER_STACK_MAX_MODIFIERS,
  modifierStackSettingsNormalize,
} from '@/modifier/stack/modifier_stack_settings.js';
import { stackFixtureEntries } from '../modifier_stack_fixture.js';

describe('modifier stack clipboard', () => {
  it('copies modifiers and appends them with fresh ids', () => {
    const source = modifierStackSettingsNormalize({
      modifiers: stackFixtureEntries([{ kind: 'mirror', parameters: { axis: 'z' } }, 'bevel']),
    });
    const copied = modifierStackClipboardCopy(source);
    expect(copied.modifiers.map((entry) => entry.kind)).toEqual(['mirror', 'bevel']);
    const target = modifierStackSettingsNormalize({ modifiers: stackFixtureEntries(['mirror']) });
    const { stack, skipped } = modifierStackClipboardPaste(target, copied);
    expect(skipped).toBe(0);
    expect(stack.modifiers.map((entry) => entry.kind)).toEqual(['mirror', 'mirror', 'bevel']);
    expect(new Set(stack.modifiers.map((entry) => entry.id)).size).toBe(3);
    expect(stack.modifiers[1]?.name).toBe('Mirror 2');
    expect(stack.modifiers[1]?.parameters['axis']).toBe('z');
  });

  it('leaves out unknown kinds and entries past the limit', () => {
    const known = stackFixtureEntries(['mirror'])[0];
    if (!known) throw new Error('fixture missing');
    const unknown = { ...known, id: 'x', kind: 'from-the-future' };
    const empty = modifierStackSettingsNormalize({});
    expect(modifierStackClipboardPaste(empty, { modifiers: [unknown] })).toEqual({ stack: empty, skipped: 1 });
    const full = modifierStackSettingsNormalize({
      modifiers: stackFixtureEntries(Array.from({ length: MODIFIER_STACK_MAX_MODIFIERS }, () => 'mirror')),
    });
    const copied = modifierStackClipboardCopy(full, [full.modifiers[0]?.id ?? '']);
    expect(copied.modifiers).toHaveLength(1);
    expect(modifierStackClipboardPaste(full, copied).skipped).toBe(1);
  });

  it('pastes settings only onto a modifier of the same kind', () => {
    const [copied, other] = stackFixtureEntries([{ kind: 'mirror', parameters: { axis: 'z' } }, 'mirror']);
    if (!copied || !other) throw new Error('fixture missing');
    const settings = modifierStackClipboardSettingsCopy(copied);
    const target = modifierStackSettingsNormalize({ modifiers: [other] });
    const id = target.modifiers[0]?.id ?? '';
    const next = modifierStackClipboardSettingsPaste(target, id, settings);
    expect(next?.modifiers[0]?.parameters['axis']).toBe('z');
    expect(next?.modifiers[0]?.id).toBe(id);
    expect(modifierStackClipboardSettingsPaste(target, id, { ...settings, kind: 'shear' })).toBeNull();
  });
});
