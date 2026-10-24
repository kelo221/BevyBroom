import type { PreviewAuthoredState } from '@/preview/protocol/preview_protocol_types.js';

/** File name of the manifest inside a level directory. */
export const LEVEL_BUILD_MANIFEST_FILE_NAME = 'level.broom.json';

/**
 * Manifest format written by Build Level; version 1 files carry no version
 * field.
 */
export const LEVEL_BUILD_MANIFEST_VERSION = 2;

/** Most characters a level directory name keeps. */
const LEVEL_BUILD_NAME_MAXIMUM_LENGTH = 64;

/**
 * Everything a game needs to load a built level without the editor: the
 * geometry file, the authored state that goes with it and the materials the
 * geometry uses. Field names match the game's manifest.
 */
export interface LevelBuildManifest {
  /** Manifest format version. */
  manifest_version: number;
  /** Preview protocol version of the authored state. */
  protocol: number;
  /** Sanitized level directory name. */
  level_name: string;
  /** Geometry GLB file name inside the level directory. */
  geometry_file: string;
  /** Geometry revision the state belongs to. */
  geometry_revision: number;
  /**
   * Authored objects with their transforms, lights, rooms, portals and
   * components.
   */
  state: PreviewAuthoredState;
  /** Game material ids the geometry uses, sorted. */
  materials: string[];
}

/**
 * Turns a name into a level directory name the game accepts: lowercase ASCII
 * letters, digits, underscores and hyphens, everything else as an underscore,
 * and "level" when nothing usable remains.
 *
 * @param name Raw level name, such as the scene file name.
 * @returns Sanitized level name.
 */
export function levelBuildNameSanitize(name: string): string {
  const cleaned = [...name.trim()]
    .map((character) => levelBuildNameCharacterSanitize(character))
    .slice(0, LEVEL_BUILD_NAME_MAXIMUM_LENGTH)
    .join('');
  return /^_*$/.test(cleaned) ? 'level' : cleaned;
}

/**
 * Maps one character of a level name to an accepted character.
 *
 * @param character Character to map.
 * @returns The lowercase character, or an underscore.
 */
function levelBuildNameCharacterSanitize(character: string): string {
  if (/^[a-z0-9_-]$/.test(character)) {
    return character;
  }
  return /^[A-Z]$/.test(character) ? character.toLowerCase() : '_';
}

/**
 * Returns the geometry file name of one build. Stamps grow with every build so
 * a new file never replaces the one a running game shows.
 *
 * @param stamp Build stamp.
 * @returns File name such as geometry_0000000000000007.glb.
 */
export function levelBuildGeometryFileName(stamp: number): string {
  return `geometry_${String(stamp).padStart(16, '0')}.glb`;
}

/**
 * Reads the stamp of a geometry file name.
 *
 * @param fileName File name in a level directory.
 * @returns The stamp, or null when the name is no geometry file.
 */
export function levelBuildGeometryStampRead(fileName: string): number | null {
  const match = /^geometry_(\d+)\.glb$/.exec(fileName);
  return match?.[1] ? Number(match[1]) : null;
}
