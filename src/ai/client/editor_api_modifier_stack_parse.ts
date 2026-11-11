import { modifierStackKindFind, modifierStackKinds } from '@/modifier/stack/modifier_stack_catalog.js';
import { modifierStackEntryCreate, modifierStackSettingsNormalize } from '@/modifier/stack/modifier_stack_settings.js';
import type { ModifierStackEntry, ModifierStackSettings } from '@/modifier/stack/modifier_stack_types.js';

/**
 * Applies the stack arguments of an MCP call to a stack: modifiers, grouping,
 * excludedIds and enabled. Arguments that are absent keep their current value;
 * arguments of the wrong type are refused.
 *
 * @param current Stack before the call.
 * @param args Tool arguments.
 * @returns Normalized new stack, or a message explaining a bad argument.
 */
export function editorApiModifierStackApply(
  current: ModifierStackSettings,
  args: Record<string, unknown>,
): ModifierStackSettings | string {
  const modifiers = args['modifiers'] === undefined ? current.modifiers : editorApiModifierListParse(current, args);
  if (typeof modifiers === 'string') return modifiers;
  const grouping = args['grouping'];
  if (grouping !== undefined && grouping !== 'compound' && grouping !== 'brush') {
    return 'grouping must be compound or brush';
  }
  const excludedIds = editorApiModifierExcludedIdsParse(current, args['excludedIds']);
  if (typeof excludedIds === 'string') return excludedIds;
  return modifierStackSettingsNormalize({
    ...current,
    modifiers,
    grouping: grouping ?? current.grouping,
    excludedIds,
    enabled: typeof args['enabled'] === 'boolean' ? args['enabled'] : current.enabled,
  });
}

/**
 * Parses the excludedIds argument.
 *
 * @param current Stack before the call.
 * @param value ExcludedIds argument, or undefined to keep the current list.
 * @returns Ids, or a message when the argument is not a list of strings.
 */
function editorApiModifierExcludedIdsParse(current: ModifierStackSettings, value: unknown): string[] | string {
  if (value === undefined) return current.excludedIds;
  if (!Array.isArray(value) || !value.every((id) => typeof id === 'string')) {
    return 'excludedIds must be a list of id strings';
  }
  return value;
}

/**
 * Parses the modifiers argument into entries, in order.
 *
 * @param current Stack before the call; entries naming one of its ids start
 *   from it.
 * @param args Tool arguments with a modifiers list.
 * @returns Entries, or a message explaining a bad argument.
 */
function editorApiModifierListParse(
  current: ModifierStackSettings,
  args: Record<string, unknown>,
): ModifierStackEntry[] | string {
  const list = args['modifiers'];
  if (!Array.isArray(list)) return 'modifiers must be a list';
  const entries: ModifierStackEntry[] = [];
  for (const item of list) {
    const entry = editorApiModifierEntryParse(current, entries, item);
    if (typeof entry === 'string') return entry;
    entries.push(entry);
  }
  return entries;
}

/**
 * Parses one modifier: starts from the existing entry with the same id or from
 * a new entry of the kind, then applies name, enabled and parameters.
 *
 * @param current Stack before the call.
 * @param earlier Entries parsed so far, used for unique ids and names.
 * @param item One element of the modifiers argument.
 * @returns Entry, or a message explaining a bad argument.
 */
function editorApiModifierEntryParse(
  current: ModifierStackSettings,
  earlier: readonly ModifierStackEntry[],
  item: unknown,
): ModifierStackEntry | string {
  const input = (item && typeof item === 'object' ? item : {}) as Partial<ModifierStackEntry>;
  const base = editorApiModifierEntryBase(current, earlier, input);
  if (typeof base === 'string') return base;
  const parameters = editorApiModifierParametersParse(input.parameters);
  if (typeof parameters === 'string') return parameters;
  return {
    ...base,
    name: typeof input.name === 'string' && input.name.trim() !== '' ? input.name : base.name,
    enabled: typeof input.enabled === 'boolean' ? input.enabled : base.enabled,
    parameters: { ...base.parameters, ...parameters },
  };
}

/**
 * Parses the parameters of one modifier argument.
 *
 * @param value Parameters argument, or undefined for none.
 * @returns Parameters by key, or a message when the argument is not an object.
 */
function editorApiModifierParametersParse(value: unknown): Record<string, unknown> | string {
  if (value === undefined) return {};
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return 'parameters must be an object of parameter values by key';
  }
  return value as Record<string, unknown>;
}

/**
 * Returns the entry a parsed modifier starts from.
 *
 * @param current Stack before the call.
 * @param earlier Entries parsed so far.
 * @param input Parsed modifier argument.
 * @returns Existing or new entry, or a message for an unknown kind or id.
 */
function editorApiModifierEntryBase(
  current: ModifierStackSettings,
  earlier: readonly ModifierStackEntry[],
  input: Partial<ModifierStackEntry>,
): ModifierStackEntry | string {
  if (typeof input.id === 'string') {
    const existing = current.modifiers.find((entry) => entry.id === input.id);
    return existing ? structuredClone(existing) : `No modifier with id ${input.id} in this volume`;
  }
  if (typeof input.kind !== 'string' || !modifierStackKindFind(input.kind)) {
    return `Unknown modifier kind ${String(input.kind)}; known kinds: ${modifierStackKinds.map((kind) => kind.id).join(', ')}`;
  }
  return modifierStackEntryCreate(input.kind, [...current.modifiers, ...earlier]);
}
