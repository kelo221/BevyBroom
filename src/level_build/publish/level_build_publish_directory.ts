import { levelBuildNameSanitize } from '@/level_build/manifest/level_build_manifest.js';

/**
 * Returns the directory a level package of the given name is published into.
 *
 * @param levelDirectory Absolute level directory of the project, forward
 *   slashes.
 * @param levelName Level name; sanitized the way Build Level sanitizes it.
 * @returns Absolute package directory, forward slashes.
 */
export function levelBuildPublishDirectoryRead(levelDirectory: string, levelName: string): string {
  return `${levelDirectory}/${levelBuildNameSanitize(levelName)}`;
}
