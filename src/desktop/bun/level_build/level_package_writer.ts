import {
  projectFileSystemNodeCreate,
  projectFileWriteAtomic,
  type ProjectFileSystem,
} from '@/desktop/bun/project_files/project_file_system_node.js';
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
  constructor(private readonly fileSystem: ProjectFileSystem = projectFileSystemNodeCreate()) {}

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
      projectFileWriteAtomic(
        this.fileSystem,
        `${levelDirectory}/${geometryFile}`,
        Buffer.from(request.glbBase64, 'base64'),
      );
      const manifest = this.manifestFinalize(request.manifest, geometryFile, geometryRevision);
      projectFileWriteAtomic(
        this.fileSystem,
        `${levelDirectory}/${LEVEL_BUILD_MANIFEST_FILE_NAME}`,
        this.manifestBytes(manifest),
      );
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
