import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import {
  LEVEL_BUILD_MANIFEST_VERSION,
  levelBuildGeometryFileName,
  levelBuildGeometryStampRead,
  levelBuildNameSanitize,
  type LevelBuildManifest,
} from '@/level_build/manifest/level_build_manifest.js';
import {
  LevelBuildManifestBuilder,
  LEVEL_BUILD_SESSION_ID,
} from '@/level_build/manifest/level_build_manifest_builder.js';
import { documentIdentityEnsure } from '@/io/document/document_identity.js';

/** Manifest fixture shared with the game bridge's Rust tests. */
const LEVEL_BUILD_MANIFEST_FIXTURE = resolve(__dirname, '../../../bevy/fixtures/level_manifest_sample.json');

/** Every manifest field; the record type keeps the list exhaustive. */
const LEVEL_BUILD_MANIFEST_FIELDS: Record<keyof LevelBuildManifest, true> = {
  manifest_version: true,
  protocol: true,
  level_name: true,
  geometry_file: true,
  geometry_revision: true,
  state: true,
  materials: true,
};

/**
 * Builds a world holding one named group with a mesh inside.
 *
 * @returns World root.
 */
function worldCreate(): THREE.Group {
  const world = new THREE.Group();
  const group = new THREE.Group();
  group.name = 'Hall';
  group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  world.add(group);
  return world;
}

/** Unit tests for the version 2 level manifest the game loads. */
describe('level build manifest', () => {
  it('names exactly the fields of the shared fixture the game parses', () => {
    const fixture = JSON.parse(readFileSync(LEVEL_BUILD_MANIFEST_FIXTURE, 'utf8')) as Record<string, unknown>;
    expect(Object.keys(fixture).sort()).toEqual(Object.keys(LEVEL_BUILD_MANIFEST_FIELDS).sort());
    expect(fixture['manifest_version']).toBe(LEVEL_BUILD_MANIFEST_VERSION);
  });

  it('sanitizes level names like the game does', () => {
    expect(levelBuildNameSanitize('  Castle Keep!  ')).toBe('castle_keep_');
    expect(levelBuildNameSanitize('level-2_b')).toBe('level-2_b');
    expect(levelBuildNameSanitize('???')).toBe('level');
    expect(levelBuildNameSanitize('')).toBe('level');
    expect(levelBuildNameSanitize('x'.repeat(100))).toHaveLength(64);
  });

  it('round-trips geometry file stamps and ignores other files', () => {
    for (const stamp of [1, 42, 9_000_000]) {
      expect(levelBuildGeometryStampRead(levelBuildGeometryFileName(stamp))).toBe(stamp);
    }
    expect(levelBuildGeometryStampRead('level.broom.json')).toBeNull();
    expect(levelBuildGeometryStampRead('geometry_.glb')).toBeNull();
  });

  it('builds a manifest whose state lists every authored object of the world', () => {
    const world = worldCreate();
    const manifest = LevelBuildManifestBuilder.build({
      worldGroup: world,
      levelName: 'My Hall',
      projectIdentifier: 'project-a',
      geometryRevision: 3,
      geometryFile: levelBuildGeometryFileName(3),
      materials: ['b/wood', 'a/stone'],
    });
    expect(manifest.level_name).toBe(levelBuildNameSanitize('My Hall'));
    expect(manifest.materials).toEqual(['a/stone', 'b/wood']);
    expect(manifest.state.document_id).toBe(documentIdentityEnsure(world));
    expect(manifest.state.project_id).toBe('project-a');
    expect(manifest.state.session_id).toBe(LEVEL_BUILD_SESSION_ID);
    expect(manifest.state.geometry_revision).toBe(manifest.geometry_revision);
    expect(manifest.state.objects.map((object) => object.name)).toContain('Hall');
  });
});
