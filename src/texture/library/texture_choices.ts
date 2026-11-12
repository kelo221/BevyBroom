import { getTextureMapCache } from './texture_map_cache.js';

/** One texture in a picker: its id and the label to show. */
export interface TextureChoice {
  value: string;
  label: string;
}

/**
 * Lists the library's textures, then any stored id the library does not list,
 * so showing or picking a stored texture never unassigns it.
 *
 * @param extraIds Stored ids to keep visible; empty ids are skipped.
 * @returns Picker entries.
 */
export function textureChoicesList(extraIds: readonly string[] = []): TextureChoice[] {
  const entries = getTextureMapCache().getLibrary()?.getEntries() ?? [];
  const choices: TextureChoice[] = entries.map((entry) => ({ value: entry.id, label: entry.displayName }));
  const listed = new Set(choices.map((choice) => choice.value));
  for (const id of extraIds) {
    if (id === '' || listed.has(id)) continue;
    listed.add(id);
    choices.push({ value: id, label: id });
  }
  return choices;
}
