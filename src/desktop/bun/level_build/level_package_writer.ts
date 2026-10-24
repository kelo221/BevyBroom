import { closeSync, fsyncSync, mkdirSync, openSync, readdirSync, renameSync, rmSync, writeSync } from 'node:fs';
import {
  LEVEL_BUILD_MANIFEST_FILE_NAME,
  levelBuildGeometryFileName,
  levelBuildGeometryStampRead,
  type LevelBuildManifest,
} from '@/level_build/manifest/level_build_manifest.js';
import type {
  LevelBuildPublishRequest,
  LevelBuildPublishResult,
} from '@/level_build/publish/level_build_publish_types.js';

/** File operations the level package writer needs. */
export interface LevelPackageFileSystem {
  /**
   * Creates a directory and its parents.
   *
   * @param path Absolute directory.
   */
  directoryEnsure(path: string): void;
  /**
   * Lists the file names of a directory.
   *
   * @param path Absolute directory.
   * @returns File names, empty when the directory is missing.
   */
  fileNamesList(path: string): string[];
  /**
   * Writes bytes to a file and flushes them to disk.
   *
   * @param path Absolute file path.
   * @param bytes File content.
   */
  fileWriteFlushed(path: string, bytes: Uint8Array): void;
  /**
   * Renames a file, replacing the target.
   *
   * @param from Existing path.
   * @param to New path.
   */
  fileRename(from: string, to: string): void;
  /**
   * Deletes a file when it exists.
   *
   * @param path Absolute file path.
   */
  fileRemove(path: string): void;
}

/**
 * Writes a level package so a reader never sees a half-written level: the
 * geometry goes to a new file, the manifest is replaced in one rename, and only
 * then are older geometry files removed. A failure before the rename leaves the
 * previous manifest and the geometry it names untouched.
 */
export class LevelPackageWriter {
  /**
   * Creates the writer.
   *
   * @param fileSystem File operations; the real file system by default.
   */
  constructor(private readonly fileSystem: LevelPackageFileSystem = levelPackageFileSystemNodeCreate()) {}

  /**
   * Publishes a level package into a level directory.
   *
   * @param levelDirectory Absolute level directory, forward slashes.
   * @param request Geometry and manifest to publish.
   * @returns Where the package went, or why nothing changed.
   */
  publish(levelDirectory: string, request: LevelBuildPublishRequest): LevelBuildPublishResult {
    this.fileSystem.directoryEnsure(levelDirectory);
    const existingFiles = this.fileSystem.fileNamesList(levelDirectory);
    const geometryRevision = this.stampNextRead(existingFiles);
    const geometryFile = levelBuildGeometryFileName(geometryRevision);
    try {
      this.fileWriteAtomic(`${levelDirectory}/${geometryFile}`, Buffer.from(request.glbBase64, 'base64'));
      const manifest = this.manifestFinalize(request.manifest, geometryFile, geometryRevision);
      this.fileWriteAtomic(`${levelDirectory}/${LEVEL_BUILD_MANIFEST_FILE_NAME}`, this.manifestBytes(manifest));
    } catch (error) {
      this.fileSystem.fileRemove(`${levelDirectory}/${geometryFile}`);
      return { ok: false, message: `Level package not written: ${this.errorMessageRead(error)}` };
    }
    const removedGeometryFiles = this.geometryFilesPrune(levelDirectory, existingFiles);
    return { ok: true, levelDirectory, geometryFile, geometryRevision, removedGeometryFiles };
  }

  /**
   * Returns a stamp above every geometry file already in the directory.
   *
   * @param existingFiles File names of the level directory.
   * @returns Next stamp, at least one.
   */
  private stampNextRead(existingFiles: readonly string[]): number {
    const stamps = existingFiles.map((name) => levelBuildGeometryStampRead(name) ?? 0);
    return Math.max(0, ...stamps) + 1;
  }

  /**
   * Returns the manifest naming the written geometry.
   *
   * @param manifest Manifest of the request.
   * @param geometryFile Geometry file name.
   * @param geometryRevision Geometry revision.
   * @returns Manifest ready to write.
   */
  private manifestFinalize(
    manifest: LevelBuildManifest,
    geometryFile: string,
    geometryRevision: number,
  ): LevelBuildManifest {
    const state = { ...manifest.state, geometry_revision: geometryRevision };
    return { ...manifest, geometry_file: geometryFile, geometry_revision: geometryRevision, state };
  }

  /**
   * Serializes a manifest as indented JSON.
   *
   * @param manifest Manifest to write.
   * @returns UTF-8 bytes.
   */
  private manifestBytes(manifest: LevelBuildManifest): Uint8Array {
    return new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`);
  }

  /**
   * Writes a file through a flushed temporary sibling and a rename.
   *
   * @param path Final file path.
   * @param bytes File content.
   */
  private fileWriteAtomic(path: string, bytes: Uint8Array): void {
    const temporaryPath = `${path}.tmp`;
    this.fileSystem.fileWriteFlushed(temporaryPath, bytes);
    this.fileSystem.fileRename(temporaryPath, path);
  }

  /**
   * Removes the geometry files that existed before this build.
   *
   * @param levelDirectory Level directory.
   * @param existingFiles File names listed before the build.
   * @returns Names of the removed files; files still in use are kept.
   */
  private geometryFilesPrune(levelDirectory: string, existingFiles: readonly string[]): string[] {
    return existingFiles
      .filter((name) => levelBuildGeometryStampRead(name) !== null)
      .filter((name) => this.fileRemoveIfPossible(`${levelDirectory}/${name}`));
  }

  /**
   * Deletes a file, keeping it when the system refuses.
   *
   * @param path File to delete.
   * @returns True when the file was deleted.
   */
  private fileRemoveIfPossible(path: string): boolean {
    try {
      this.fileSystem.fileRemove(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reads the message of a thrown value.
   *
   * @param error Thrown value.
   * @returns Message text.
   */
  private errorMessageRead(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Returns the file operations backed by the real file system.
 *
 * @returns Node file system operations.
 */
export function levelPackageFileSystemNodeCreate(): LevelPackageFileSystem {
  return {
    directoryEnsure: (path) => mkdirSync(path, { recursive: true }),
    fileNamesList: (path) => readdirSync(path),
    fileWriteFlushed: (path, bytes) => levelPackageFileWriteFlushed(path, bytes),
    fileRename: (from, to) => renameSync(from, to),
    fileRemove: (path) => rmSync(path, { force: true }),
  };
}

/**
 * Writes bytes to a file and flushes them before closing it.
 *
 * @param path Absolute file path.
 * @param bytes File content.
 */
function levelPackageFileWriteFlushed(path: string, bytes: Uint8Array): void {
  const descriptor = openSync(path, 'w');
  try {
    writeSync(descriptor, bytes);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}
