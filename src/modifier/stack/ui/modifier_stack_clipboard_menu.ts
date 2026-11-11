import type { MenuContextItem } from '@/ui/menu/menu_context.js';
import { modifierStackKindFind } from '@/modifier/stack/modifier_stack_catalog.js';
import type { ModifierStackEntry, ModifierStackSettings } from '@/modifier/stack/modifier_stack_types.js';
import {
  modifierStackClipboardCopy,
  modifierStackClipboardPaste,
  modifierStackClipboardSettingsOf,
  modifierStackClipboardSettingsPaste,
  type ModifierStackClipboardModifiers,
} from '@/modifier/stack/clipboard/modifier_stack_clipboard.js';
import { modifierStackClipboardStoreShared } from '@/modifier/stack/clipboard/modifier_stack_clipboard_store.js';

/** What the clipboard menu entries need from the modifier panel. */
export interface ModifierStackClipboardMenuHost {
  /** Returns the bound volume's stack, or null. */
  read: () => ModifierStackSettings | null;
  /** Pushes one undoable stack edit. */
  edit: (change: (stack: ModifierStackSettings) => ModifierStackSettings) => void;
  /** Shows a short note in the panel status. */
  notice: (text: string) => void;
}

/**
 * Builds the volume menu's Copy all modifiers and Paste modifiers entries.
 *
 * @param host Modifier panel.
 * @returns Menu items.
 */
export function modifierStackClipboardVolumeItems(host: ModifierStackClipboardMenuHost): MenuContextItem[] {
  const stack = host.read();
  const copied = stack ? modifierStackClipboardCopy(stack) : { modifiers: [] };
  const count = copied.modifiers.length;
  return [
    {
      label: 'Copy All Modifiers',
      disabled: count === 0,
      callback: () => modifierStackClipboardWrite(host, copied, `Copied ${count} modifier(s)`),
    },
    { label: 'Paste Modifiers', disabled: !stack, callback: () => void modifierStackClipboardPasteModifiers(host) },
  ];
}

/**
 * Builds a card menu's clipboard entries: Copy, which carries the card's
 * settings, and Paste settings, which applies a copied modifier of the same
 * kind.
 *
 * @param host Modifier panel.
 * @param entry Card's entry.
 * @returns Menu items.
 */
export function modifierStackClipboardCardItems(
  host: ModifierStackClipboardMenuHost,
  entry: ModifierStackEntry,
): MenuContextItem[] {
  const copied = { modifiers: [structuredClone(entry)] };
  return [
    { label: 'Copy', callback: () => modifierStackClipboardWrite(host, copied, `Copied ${entry.name}`) },
    {
      label: 'Paste Settings',
      disabled: !modifierStackClipboardSettingsReady(entry.kind),
      callback: () => void modifierStackClipboardPasteSettings(host, entry),
    },
  ];
}

/**
 * Returns whether Paste settings may apply to a kind: this window copied a
 * modifier of that kind, or copied nothing (another window may have).
 *
 * @param kind Target kind.
 * @returns True when the entry is enabled.
 */
function modifierStackClipboardSettingsReady(kind: string): boolean {
  if (modifierStackClipboardStoreShared.empty()) return true;
  return modifierStackClipboardSettingsOf(modifierStackClipboardStoreShared.peek(), kind) !== null;
}

/**
 * Writes clipboard data and confirms it.
 *
 * @param host Modifier panel.
 * @param data Copied modifiers.
 * @param text Confirmation note.
 */
function modifierStackClipboardWrite(
  host: ModifierStackClipboardMenuHost,
  data: ModifierStackClipboardModifiers,
  text: string,
): void {
  void modifierStackClipboardStoreShared.write(data);
  host.notice(text);
}

/**
 * Appends copied modifiers to the bound stack as one undo step.
 *
 * @param host Modifier panel.
 * @returns Resolves once pasted.
 */
async function modifierStackClipboardPasteModifiers(host: ModifierStackClipboardMenuHost): Promise<void> {
  const data = await modifierStackClipboardStoreShared.read();
  const stack = host.read();
  if (!data || !stack) return host.notice('Nothing to paste: copy a modifier first');
  const { stack: next, skipped } = modifierStackClipboardPaste(stack, data);
  const added = next.modifiers.length - stack.modifiers.length;
  host.edit(() => next);
  const left = skipped > 0 ? `, left out ${skipped} (unknown kinds or a full stack)` : '';
  host.notice(`Pasted ${added} modifier(s)${left}`);
}

/**
 * Overrides a card's fields with a copied modifier of the same kind, as one
 * undo step.
 *
 * @param host Modifier panel.
 * @param entry Target entry.
 * @returns Resolves once pasted.
 */
async function modifierStackClipboardPasteSettings(
  host: ModifierStackClipboardMenuHost,
  entry: ModifierStackEntry,
): Promise<void> {
  const data = modifierStackClipboardSettingsOf(await modifierStackClipboardStoreShared.read(), entry.kind);
  const stack = host.read();
  const label = modifierStackKindFind(entry.kind)?.label ?? entry.kind;
  if (!data) return host.notice(`Nothing to paste: copy a ${label} modifier first`);
  const next = stack ? modifierStackClipboardSettingsPaste(stack, entry.id, data) : null;
  if (!next) return host.notice(`Copied settings are for ${modifierStackKindFind(data.kind)?.label ?? data.kind}`);
  host.edit(() => next);
  host.notice(`Pasted settings into ${entry.name}`);
}
