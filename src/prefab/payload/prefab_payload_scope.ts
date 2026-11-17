import type { ObjectEntry } from '@/io/scene/io_types.js';
import type { ClipboardPayload } from '@/clipboard/payload/clipboard_payload_types.js';

/**
 * Returns a copy of a prefab payload whose object names and entity I/O targets
 * that point at its own objects carry a suffix, so several placed copies never
 * trigger each other. Targets outside the prefab keep their names.
 *
 * @param payload Captured prefab payload.
 * @param suffix Suffix such as "inst2"; empty returns an unchanged copy.
 * @returns Scoped payload copy.
 */
export function prefabPayloadScope(payload: ClipboardPayload, suffix: string): ClipboardPayload {
  const copy = structuredClone(payload);
  const trimmedSuffix = suffix.trim();
  if (trimmedSuffix === '') {
    return copy;
  }
  const internalNames = prefabPayloadInternalNamesCollect(copy.objects);
  copy.objects.forEach((entry) => prefabPayloadEntryScope(entry, internalNames, trimmedSuffix));
  return copy;
}

/**
 * Collects the non-empty names of every object entry.
 *
 * @param entries Object entries of a payload.
 * @returns Trimmed names.
 */
function prefabPayloadInternalNamesCollect(entries: readonly ObjectEntry[]): Set<string> {
  return new Set(entries.map((entry) => entry.name.trim()).filter((name) => name !== ''));
}

/**
 * Scopes one entry's name and the targets of its entity I/O outputs.
 *
 * @param entry Object entry, changed in place.
 * @param internalNames Names of the payload's own objects.
 * @param suffix Non-empty scope suffix.
 */
function prefabPayloadEntryScope(entry: ObjectEntry, internalNames: ReadonlySet<string>, suffix: string): void {
  entry.name = prefabPayloadNameScope(entry.name, internalNames, suffix);
  const outputs = entry.gameLogicOutputs;
  if (outputs === undefined) {
    return;
  }
  entry.gameLogicOutputs = outputs.map((output) => ({
    ...output,
    target: prefabPayloadNameScope(output.target, internalNames, suffix),
  }));
}

/**
 * Appends the suffix to a name of one of the payload's own objects.
 *
 * @param name Original name.
 * @param internalNames Names of the payload's own objects.
 * @param suffix Non-empty scope suffix.
 * @returns Scoped name, or the original name when it is not internal.
 */
function prefabPayloadNameScope(name: string, internalNames: ReadonlySet<string>, suffix: string): string {
  const trimmed = name.trim();
  return internalNames.has(trimmed) ? `${trimmed}_${suffix}` : name;
}
