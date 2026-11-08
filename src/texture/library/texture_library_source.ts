/** Source name of the built-in checker texture. */
export const TEXTURE_LIBRARY_SOURCE_BUILT_IN = 'Built-in';

/** Source name of the materials read from the connected game's catalog. */
export const TEXTURE_LIBRARY_SOURCE_GAME_MATERIALS = 'Game materials';

/** Source name of the images found in the open project's texture directories. */
export const TEXTURE_LIBRARY_SOURCE_PROJECT_TEXTURES = 'Project textures';

/** Source name of the images of a folder the user opened by hand. */
export const TEXTURE_LIBRARY_SOURCE_LOCAL_FOLDER = 'Local folder';

/**
 * Order in which the named sources follow the built-in checker; an earlier
 * source wins when two sources hold the same texture id.
 */
export const TEXTURE_LIBRARY_SOURCE_ORDER: readonly string[] = [
  TEXTURE_LIBRARY_SOURCE_GAME_MATERIALS,
  TEXTURE_LIBRARY_SOURCE_PROJECT_TEXTURES,
  TEXTURE_LIBRARY_SOURCE_LOCAL_FOLDER,
];

/**
 * Returns the position of a source in the merged texture list; sources missing
 * from {@link TEXTURE_LIBRARY_SOURCE_ORDER} come after every known source.
 *
 * @param sourceName Name of the texture source.
 * @returns Sort rank, lower comes first.
 */
export function textureLibrarySourceRank(sourceName: string): number {
  const knownRank = TEXTURE_LIBRARY_SOURCE_ORDER.indexOf(sourceName);
  return knownRank === -1 ? TEXTURE_LIBRARY_SOURCE_ORDER.length : knownRank;
}
