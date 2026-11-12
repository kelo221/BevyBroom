import { levelBuildNameSanitize } from '@/level_build/manifest/level_build_manifest.js';

/** File name extension of level documents, compared without case. */
export const PROJECT_LEVEL_DOCUMENT_EXTENSION = '.json';

/** Document directory used when the project file names none. */
export const PROJECT_LEVEL_DOCUMENT_DIRECTORY_DEFAULT = 'broom/documents';

/**
 * One level the project file lists explicitly: a stable id the game loads the
 * built level by, a display name and the editor document it is authored in.
 */
export interface ProjectLevelEntry {
  /** Level name the built level is published under, already sanitized. */
  id: string;
  /** Display name shown to the level designer. */
  name: string;
  /**
   * Scene document path relative to the document directory, forward slashes and
   * a ".json" extension.
   */
  document: string;
}

/**
 * Returns whether a file name is that of a level document.
 *
 * @param fileName File name or path.
 * @returns True for ".json" files.
 */
export function projectLevelDocumentFileNameIs(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(PROJECT_LEVEL_DOCUMENT_EXTENSION);
}

/**
 * Returns the file stem of a document path: the last segment without its
 * extension.
 *
 * @param document Document path with forward slashes.
 * @returns File stem; the whole last segment when it has no extension.
 */
export function projectLevelDocumentStemRead(document: string): string {
  const fileName = document.split('/').pop() ?? document;
  const extensionStart = fileName.lastIndexOf('.');
  return extensionStart <= 0 ? fileName : fileName.slice(0, extensionStart);
}

/**
 * Derives the level id of a document the project file does not list: the
 * sanitized document path without its extension, so nested documents keep
 * distinct ids.
 *
 * @param document Document path relative to the document directory.
 * @returns Level id the game accepts as a level name.
 */
export function projectLevelIdFromDocument(document: string): string {
  const withoutExtension = document.replace(/\.[^./]*$/, '');
  return levelBuildNameSanitize(withoutExtension.replace(/\//g, '_'));
}

/**
 * Derives the document file name of a new level from its display name: the
 * sanitized name with the document extension.
 *
 * @param name Display name typed by the level designer.
 * @returns Document path relative to the document directory.
 */
export function projectLevelDocumentFromName(name: string): string {
  return `${levelBuildNameSanitize(name)}${PROJECT_LEVEL_DOCUMENT_EXTENSION}`;
}
