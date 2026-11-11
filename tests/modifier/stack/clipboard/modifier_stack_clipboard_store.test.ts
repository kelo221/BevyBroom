import { describe, expect, it } from 'vitest';
import { ClipboardMemory } from '@/clipboard/controller/clipboard_memory.js';
import { ClipboardSystemAccess, type ClipboardSystemTextApi } from '@/clipboard/system/clipboard_system_access.js';
import {
  ModifierStackClipboardStore,
  modifierStackClipboardTextRead,
  modifierStackClipboardTextWrite,
} from '@/modifier/stack/clipboard/modifier_stack_clipboard_store.js';
import { stackFixtureEntries } from '../modifier_stack_fixture.js';

/**
 * Builds a fake system clipboard that keeps the last written text.
 *
 * @returns Clipboard API and a reader of its current text.
 */
function systemClipboardFake(): { api: ClipboardSystemTextApi; text: () => string } {
  let stored = '';
  const api: ClipboardSystemTextApi = {
    readText: () => Promise.resolve(stored),
    writeText: (text: string) => {
      stored = text;
      return Promise.resolve();
    },
  };
  return { api, text: () => stored };
}

describe('modifier stack clipboard store', () => {
  it('round-trips copied modifiers through text and rejects foreign text', () => {
    const modifiers = stackFixtureEntries([{ kind: 'mirror', parameters: { axis: 'z' } }, 'bevel']);
    const text = modifierStackClipboardTextWrite({ modifiers });
    expect(modifierStackClipboardTextRead(text)?.modifiers).toEqual(modifiers);
    expect(modifierStackClipboardTextRead('not json')).toBeNull();
    expect(modifierStackClipboardTextRead(JSON.stringify({ format: 'other', version: 1, modifiers }))).toBeNull();
    expect(modifierStackClipboardTextRead(null)).toBeNull();
  });

  it('writes the system clipboard and pastes from it', async () => {
    const fake = systemClipboardFake();
    const store = new ModifierStackClipboardStore(new ClipboardSystemAccess(() => fake.api), new ClipboardMemory());
    expect(store.empty()).toBe(true);
    const modifiers = stackFixtureEntries(['shear']);
    await store.write({ modifiers });
    expect(modifierStackClipboardTextRead(fake.text())?.modifiers).toEqual(modifiers);
    expect(store.empty()).toBe(false);
    expect((await store.read())?.modifiers).toEqual(modifiers);
  });

  it('falls back to the in-app copy when the system clipboard is unavailable', async () => {
    const store = new ModifierStackClipboardStore(new ClipboardSystemAccess(() => null), new ClipboardMemory());
    const modifiers = stackFixtureEntries(['smooth']);
    await store.write({ modifiers });
    expect((await store.read())?.modifiers).toEqual(modifiers);
    expect(store.peek()?.modifiers).toEqual(modifiers);
  });
});
