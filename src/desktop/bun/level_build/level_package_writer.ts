import {
  projectFileSystemNodeCreate,
  projectFileWriteAtomic,
  type ProjectFileSystem,
} from '@/desktop/bun/project_files/project_file_system_node.js';
import {
  LEVEL_BUILD_MANIFEST_FILE_NAME,
  LEVEL_BUILD_GEOMETRY_FILE_NAME,
  levelBuildGeometryFileIsNumbered,
  type LevelBuildManifest,
} from '@/level_build/manifest/level_build_manifest.js';
import { COLLISION_FILE_NAME } from '@/level_export/collision/collision_types.js';
import type {
  LevelBuildPublishRequest,
  LevelBuildPublishResult,
} from '@/level_build/publish/level_build_publish_types.js';

/** One file of a level package. */
export interface LevelPackageFile {
  readonly name: string;
  readonly bytes: Uint8Array;
}

/**
 * Writes a level package into the same three files every build: the geometry,
 * the collision document and the manifest, each replaced by one rename so a
 * reader never sees a half-written file. Numbered geometry files of older
 * builds are removed afterwards.
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
    const geometryRevision = request.geometryRevision ?? this.revisionNextRead(levelDirectory);
    const geometryFile = LEVEL_BUILD_GEOMETRY_FILE_NAME;
    try {
      this.packageFilesWrite(levelDirectory, request, geometryFile, geometryRevision);
    } catch (error) {
      return { ok: false, message: `Level package not written: ${this.errorMessageRead(error)}` };
    }
    const removedGeometryFiles = this.numberedGeometryFilesPrune(levelDirectory);
    return { ok: true, levelDirectory, geometryFile, geometryRevision, removedGeometryFiles };
  }

  /**
   * Writes the geometry, the collision document and then the manifest that
   * points at the geometry.
   *
   * @param levelDirectory Level directory.
   * @param request Built level.
   * @param geometryFile Name of the new geometry file.
   * @param geometryRevision Revision stamped into the manifest.
   */
  private packageFilesWrite(
    levelDirectory: string,
    request: LevelBuildPublishRequest,
    geometryFile: string,
    geometryRevision: number,
  ): void {
    for (const file of LevelPackageWriter.packageFilesBuild(request, geometryFile, geometryRevision)) {
      projectFileWriteAtomic(this.fileSystem, `${levelDirectory}/${file.name}`, file.bytes);
    }
  }

  /**
   * Returns the files of a level package in the order they are written: the
   * geometry, the collision document and the manifest.
   *
   * @param request Built level.
   * @param geometryFile Name of the geometry file.
   * @param geometryRevision Revision stamped into the manifest.
   * @returns File names and bytes.
   */
  static packageFilesBuild(
    request: LevelBuildPublishRequest,
    geometryFile: string,
    geometryRevision: number,
  ): LevelPackageFile[] {
    const manifest = LevelPackageWriter.manifestFinalize(request.manifest, geometryFile, geometryRevision);
    return [
      { name: geometryFile, bytes: new Uint8Array(Buffer.from(request.glbBase64, 'base64')) },
      { name: COLLISION_FILE_NAME, bytes: new TextEncoder().encode(request.collisionJson) },
      { name: LEVEL_BUILD_MANIFEST_FILE_NAME, bytes: LevelPackageWriter.manifestBytes(manifest) },
    ];
  }

  /**
   * Returns the revision after the one the package's current manifest names.
   *
   * @param levelDirectory Level directory.
   * @returns Next revision, one when there is no readable manifest.
   */
  private revisionNextRead(levelDirectory: string): number {
    try {
      const text = new TextDecoder().decode(
        this.fileSystem.fileRead(`${levelDirectory}/${LEVEL_BUILD_MANIFEST_FILE_NAME}`),
      );
      const revision = (JSON.parse(text) as Partial<LevelBuildManifest>).geometry_revision;
      return typeof revision === 'number' && Number.isFinite(revision) ? revision + 1 : 1;
    } catch {
      return 1;
    }
  }

  /**
   * Returns the manifest naming the written geometry.
   *
   * @param manifest Manifest of the request.
   * @param geometryFile Geometry file name.
   * @param geometryRevision Geometry revision.
   * @returns Manifest ready to write.
   */
  private static manifestFinalize(
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
  private static manifestBytes(manifest: LevelBuildManifest): Uint8Array {
    return new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`);
  }

  /**
   * Removes the numbered geometry files older builds left in the directory.
   *
   * @param levelDirectory Level directory.
   * @returns Names of the removed files; files still in use are kept.
   */
  private numberedGeometryFilesPrune(levelDirectory: string): string[] {
    return this.fileSystem
      .fileNamesList(levelDirectory)
      .filter((name) => levelBuildGeometryFileIsNumbered(name))
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
