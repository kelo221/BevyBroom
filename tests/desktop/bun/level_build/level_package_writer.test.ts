import { COLLISION_FILE_NAME } from '@/level_export/collision/collision_types.js';
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LevelPackageWriter } from '@/desktop/bun/level_build/level_package_writer.js';
import {
  projectFileSystemNodeCreate,
  type ProjectFileSystem,
} from '@/desktop/bun/project_files/project_file_system_node.js';
import {
  LEVEL_BUILD_MANIFEST_FILE_NAME,
  LEVEL_BUILD_MANIFEST_VERSION,
  LEVEL_BUILD_GEOMETRY_FILE_NAME,
  type LevelBuildManifest,
} from '@/level_build/manifest/level_build_manifest.js';
import type {
  LevelBuildPublishRequest,
  LevelBuildPublishSuccess,
} from '@/level_build/publish/level_build_publish_types.js';

/** Temporary directories created by the running test. */
const temporaryDirectories: string[] = [];

/**
 * Creates an empty temporary level directory.
 *
 * @returns Absolute directory path, forward slashes.
 */
function levelDirectoryCreate(): string {
  const directory = mkdtempSync(join(tmpdir(), 'broom-level-writer-'));
  temporaryDirectories.push(directory);
  return join(directory, 'levels', 'hall').replace(/\\/g, '/');
}

/**
 * Creates a publish request whose geometry is the given text.
 *
 * @param geometryText Text stored as the geometry bytes.
 * @returns Publish request.
 */
function requestCreate(geometryText: string): LevelBuildPublishRequest {
  const manifest: LevelBuildManifest = {
    manifest_version: LEVEL_BUILD_MANIFEST_VERSION,
    protocol: 4,
    level_name: 'hall',
    geometry_file: '',
    geometry_revision: 0,
    state: {
      protocol: 4,
      project_id: 'project',
      document_id: 'document',
      session_id: 'build',
      revision: 1,
      geometry_revision: 0,
      objects: [],
    },
    materials: [],
  };
  return {
    levelName: 'hall',
    glbBase64: Buffer.from(geometryText).toString('base64'),
    manifest,
    collisionJson: `{"level_name":"${geometryText}"}\n`,
  };
}

/**
 * Reads the manifest of a level directory.
 *
 * @param levelDirectory Level directory.
 * @returns Parsed manifest.
 */
function manifestRead(levelDirectory: string): LevelBuildManifest {
  return JSON.parse(readFileSync(`${levelDirectory}/${LEVEL_BUILD_MANIFEST_FILE_NAME}`, 'utf8')) as LevelBuildManifest;
}

/**
 * Publishes a request and fails the test when the writer reports a failure.
 *
 * @param writer Writer to use.
 * @param levelDirectory Level directory.
 * @param geometryText Text stored as the geometry bytes.
 * @returns Success result.
 */
function publishExpectOk(
  writer: LevelPackageWriter,
  levelDirectory: string,
  geometryText: string,
): LevelBuildPublishSuccess {
  const result = writer.publish(levelDirectory, requestCreate(geometryText));
  if (!result.ok) {
    throw new Error(result.message);
  }
  return result;
}

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

/** Unit tests for publishing a level package atomically. */
describe('LevelPackageWriter', () => {
  it('writes the geometry and a manifest that names it', () => {
    const levelDirectory = levelDirectoryCreate();
    const result = publishExpectOk(new LevelPackageWriter(), levelDirectory, 'first');
    const manifest = manifestRead(levelDirectory);
    expect(manifest.geometry_file).toBe(result.geometryFile);
    expect(manifest.geometry_revision).toBe(result.geometryRevision);
    expect(manifest.state.geometry_revision).toBe(result.geometryRevision);
    expect(readFileSync(`${levelDirectory}/${result.geometryFile}`, 'utf8')).toBe('first');
  });

  it('replaces the same three files on every build with a newer revision', () => {
    const levelDirectory = levelDirectoryCreate();
    const writer = new LevelPackageWriter();
    const first = publishExpectOk(writer, levelDirectory, 'first');
    const filesAfterFirst = readdirSync(levelDirectory).sort();
    const second = publishExpectOk(writer, levelDirectory, 'second');
    expect(second.geometryFile).toBe(LEVEL_BUILD_GEOMETRY_FILE_NAME);
    expect(second.geometryFile).toBe(first.geometryFile);
    expect(second.geometryRevision).toBeGreaterThan(first.geometryRevision);
    expect(readdirSync(levelDirectory).sort()).toEqual(filesAfterFirst);
    expect(filesAfterFirst).toEqual(
      [COLLISION_FILE_NAME, LEVEL_BUILD_GEOMETRY_FILE_NAME, LEVEL_BUILD_MANIFEST_FILE_NAME].sort(),
    );
    expect(readFileSync(`${levelDirectory}/${second.geometryFile}`, 'utf8')).toBe('second');
  });

  it('removes the numbered geometry files older builds left behind', () => {
    const levelDirectory = levelDirectoryCreate();
    const fileSystem = projectFileSystemNodeCreate();
    fileSystem.directoryEnsure(levelDirectory);
    const leftovers = ['geometry_0000000000000002.glb', 'geometry_0000000000000003.glb'];
    leftovers.forEach((name) => fileSystem.fileWriteFlushed(`${levelDirectory}/${name}`, new Uint8Array([1])));
    const result = publishExpectOk(new LevelPackageWriter(), levelDirectory, 'first');
    expect([...result.removedGeometryFiles].sort()).toEqual(leftovers);
    expect(readdirSync(levelDirectory).filter((name) => name.endsWith('.glb'))).toEqual([
      LEVEL_BUILD_GEOMETRY_FILE_NAME,
    ]);
  });

  it('writes the collision document next to the manifest', () => {
    const levelDirectory = levelDirectoryCreate();
    publishExpectOk(new LevelPackageWriter(), levelDirectory, 'first');
    expect(readFileSync(`${levelDirectory}/${COLLISION_FILE_NAME}`, 'utf8')).toBe(requestCreate('first').collisionJson);
  });

  it('keeps a requested geometry revision', () => {
    const levelDirectory = levelDirectoryCreate();
    const revision = 4242;
    const result = new LevelPackageWriter().publish(levelDirectory, {
      ...requestCreate('same'),
      geometryRevision: revision,
    });
    expect(result.ok && result.geometryRevision).toBe(revision);
    expect(manifestRead(levelDirectory).geometry_revision).toBe(revision);
  });

  it('keeps the package loadable when replacing the manifest fails', () => {
    const levelDirectory = levelDirectoryCreate();
    const first = publishExpectOk(new LevelPackageWriter(), levelDirectory, 'first');
    const failing = levelPackageFileSystemFailingOnManifestRename();
    const result = new LevelPackageWriter(failing).publish(levelDirectory, requestCreate('second'));
    expect(result.ok).toBe(false);
    expect(manifestRead(levelDirectory).geometry_revision).toBe(first.geometryRevision);
    expect(existsSync(`${levelDirectory}/${manifestRead(levelDirectory).geometry_file}`)).toBe(true);
  });
});

/**
 * Returns real file operations whose rename onto the manifest fails, as when a
 * build is interrupted before the manifest is replaced.
 *
 * @returns File system that fails the manifest rename.
 */
function levelPackageFileSystemFailingOnManifestRename(): ProjectFileSystem {
  const real = projectFileSystemNodeCreate();
  return {
    ...real,
    fileRename: (from, to) => {
      if (to.endsWith(LEVEL_BUILD_MANIFEST_FILE_NAME)) {
        throw new Error('interrupted');
      }
      real.fileRename(from, to);
    },
  };
}
