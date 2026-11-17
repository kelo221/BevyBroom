import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { LevelPackageFile } from '@/desktop/bun/level_build/level_package_writer.js';
import { levelBuildGeometryStampRead } from '@/level_build/manifest/level_build_manifest.js';

/** Compares a level package on disk with the files a fresh export produces. */
export class LevelExportPackageCheck {
  /**
   * Returns the names of the files that differ: expected files that are missing
   * or hold other bytes, and geometry files no fresh export writes.
   *
   * @param levelDirectory Directory of the package on disk.
   * @param expected Files of a fresh export.
   * @returns Differing file names, empty when the package is current.
   */
  static differencesList(levelDirectory: string, expected: readonly LevelPackageFile[]): string[] {
    const differing = expected
      .filter((file) => !LevelExportPackageCheck.fileMatches(`${levelDirectory}/${file.name}`, file.bytes))
      .map((file) => file.name);
    const expectedNames = new Set(expected.map((file) => file.name));
    const stale = existsSync(levelDirectory)
      ? readdirSync(levelDirectory).filter(
          (name) => levelBuildGeometryStampRead(name) !== null && !expectedNames.has(name),
        )
      : [];
    return [...differing, ...stale.sort()];
  }

  /**
   * Returns whether a file exists with exactly the given bytes.
   *
   * @param path File path.
   * @param bytes Expected bytes.
   * @returns True when they match.
   */
  private static fileMatches(path: string, bytes: Uint8Array): boolean {
    return existsSync(path) && Buffer.compare(readFileSync(path), Buffer.from(bytes)) === 0;
  }
}
