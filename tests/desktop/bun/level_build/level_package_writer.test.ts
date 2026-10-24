import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  LevelPackageWriter,
  levelPackageFileSystemNodeCreate,
  type LevelPackageFileSystem,
} from '@/desktop/bun/level_build/level_package_writer.js';
import {
  LEVEL_BUILD_MANIFEST_FILE_NAME,
  LEVEL_BUILD_MANIFEST_VERSION,
  levelBuildGeometryStampRead,
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
  return { levelName: 'hall', glbBase64: Buffer.from(geometryText).toString('base64'), manifest };
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

  it('gives every build a newer geometry file and removes the older ones', () => {
    const levelDirectory = levelDirectoryCreate();
    const writer = new LevelPackageWriter();
    const first = publishExpectOk(writer, levelDirectory, 'first');
    const second = publishExpectOk(writer, levelDirectory, 'second');
    expect(second.geometryRevision).toBeGreaterThan(first.geometryRevision);
    expect(second.removedGeometryFiles).toEqual([first.geometryFile]);
    const geometryFiles = readdirSync(levelDirectory).filter((name) => levelBuildGeometryStampRead(name) !== null);
    expect(geometryFiles).toEqual([second.geometryFile]);
  });

  it('keeps the previous package loadable when replacing the manifest fails', () => {
    const levelDirectory = levelDirectoryCreate();
    const first = publishExpectOk(new LevelPackageWriter(), levelDirectory, 'first');
    const failing = levelPackageFileSystemFailingOnManifestRename();
    const result = new LevelPackageWriter(failing).publish(levelDirectory, requestCreate('second'));
    expect(result.ok).toBe(false);
    expect(manifestRead(levelDirectory).geometry_file).toBe(first.geometryFile);
    expect(existsSync(`${levelDirectory}/${first.geometryFile}`)).toBe(true);
    const geometryFiles = readdirSync(levelDirectory).filter((name) => levelBuildGeometryStampRead(name) !== null);
    expect(geometryFiles).toEqual([first.geometryFile]);
  });
});

/**
 * Returns real file operations whose rename onto the manifest fails, as when a
 * build is interrupted before the manifest is replaced.
 *
 * @returns File system that fails the manifest rename.
 */
function levelPackageFileSystemFailingOnManifestRename(): LevelPackageFileSystem {
  const real = levelPackageFileSystemNodeCreate();
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
