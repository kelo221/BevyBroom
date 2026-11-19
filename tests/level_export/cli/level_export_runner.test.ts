import { afterEach, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { LevelExportRunner } from '@/level_export/cli/level_export_runner.js';
import { COLLISION_EXPORT_EXTRAS_KEY } from '@/level_export/collision/object_data_contributor_collision_extras.js';
import { COLLISION_FILE_NAME, type CollisionDocument } from '@/level_export/collision/collision_types.js';
import { levelBuildGlbMaterialIdsRead } from '@/level_build/package/level_build_glb_material_reader.js';
import {
  LEVEL_BUILD_GEOMETRY_FILE_NAME,
  LEVEL_BUILD_MANIFEST_FILE_NAME,
} from '@/level_build/manifest/level_build_manifest.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { collisionTestModelCreate } from '../collision/collision_test_models.js';
import {
  type LevelExportTestProject,
  levelExportTestDocumentWrite,
  levelExportTestProjectCreate,
  levelExportTestProjectRemove,
} from '../level_export_test_project.js';

const ZONE_CLASS = 'game::FinishZone';
const START_CLASS = 'game::PlayerStart';
const NODRAW_TEXTURE = 'textures/tools/nodraw.png';
const WALL_TEXTURE = 'textures/walls/brick.png';

const classes = [
  { type_path: ZONE_CLASS, label: 'Finish Zone', collision: 'volume', fields: [] },
  {
    type_path: START_CLASS,
    label: 'Player Start',
    fields: [{ path: 'team', label: 'Team', kind: 'text', default: 'red' }],
  },
];

/**
 * Builds a level: a room whose floor slab is nodraw, a finish zone and a turned
 * player start.
 *
 * @returns The world and its player start.
 */
function levelWorldCreate(): { world: THREE.Group; start: THREE.Group } {
  const world = new THREE.Group();
  const room = collisionTestModelCreate([
    {
      box: new THREE.Box3(new THREE.Vector3(-4, 0, -4), new THREE.Vector3(4, 3, 4)),
      operation: SolidOperation.Additive,
      textureId: WALL_TEXTURE,
    },
    {
      box: new THREE.Box3(new THREE.Vector3(-3, 0.5, -3), new THREE.Vector3(3, 2.5, 3)),
      operation: SolidOperation.Subtractive,
      textureId: WALL_TEXTURE,
    },
    {
      box: new THREE.Box3(new THREE.Vector3(-3, 0.5, -3), new THREE.Vector3(3, 0.6, 3)),
      operation: SolidOperation.Additive,
      textureId: NODRAW_TEXTURE,
    },
  ]);
  const zone = collisionTestModelCreate([
    {
      box: new THREE.Box3(new THREE.Vector3(1, 0.6, 1), new THREE.Vector3(2.5, 2, 2.5)),
      operation: SolidOperation.Additive,
    },
  ]);
  GameEntityComponentStore.write(zone.root, { [ZONE_CLASS]: {} });
  const start = GameEntityOwner.createDefault('Player Start');
  start.position.set(-1, 0.6, 0.5);
  start.rotation.set(0, Math.PI / 4, 0);
  GameEntityComponentStore.write(start, { [START_CLASS]: {} });
  world.add(room.root, zone.root, start);
  world.updateMatrixWorld(true);
  return { world, start };
}

/**
 * Reads every file of a level directory.
 *
 * @param directory Level directory.
 * @returns File bytes by name.
 */
function filesRead(directory: string): Map<string, Buffer> {
  return new Map(readdirSync(directory).map((name) => [name, readFileSync(join(directory, name))]));
}

/**
 * Exports or checks the project's level.
 *
 * @param project Test project.
 * @param isCheck True to check instead of writing.
 * @returns Run result.
 */
function run(project: LevelExportTestProject, isCheck = false): ReturnType<typeof LevelExportRunner.run> {
  return LevelExportRunner.run({
    projectFile: project.projectFile,
    levelId: project.levelId,
    outDirectory: null,
    isCheck,
  });
}

let project: LevelExportTestProject | null = null;

afterEach(() => {
  if (project) levelExportTestProjectRemove(project);
  project = null;
});

/** The command-line export writes a deterministic level package and checks it. */
describe('LevelExportRunner', () => {
  it('writes the geometry, the manifest and the collision document, the same bytes every time', async () => {
    project = levelExportTestProjectCreate(
      levelWorldCreate().world,
      { tool_textures: { nodraw: [NODRAW_TEXTURE] } },
      classes,
    );
    expect((await run(project)).ok).toBe(true);
    const first = filesRead(project.levelDirectory);
    expect([...first.keys()].filter((name) => name.endsWith('.glb'))).toEqual([LEVEL_BUILD_GEOMETRY_FILE_NAME]);
    expect(first.has(COLLISION_FILE_NAME) && first.has(LEVEL_BUILD_MANIFEST_FILE_NAME)).toBe(true);
    expect((await run(project)).ok).toBe(true);
    expect(filesRead(project.levelDirectory)).toEqual(first);
  });

  it('passes the check right after an export and fails it after the document changes', async () => {
    const level = levelWorldCreate();
    project = levelExportTestProjectCreate(level.world, {}, classes);
    await run(project);
    expect(await run(project, true)).toMatchObject({ ok: true, differences: [] });
    level.start.position.x += 1;
    levelExportTestDocumentWrite(project.documentFile, level.world);
    const checked = await run(project, true);
    expect(checked.ok).toBe(false);
    expect(checked.differences).toContain(COLLISION_FILE_NAME);
  });

  it('exports a volume as volume pieces that are not drawn, and nodraw faces as collision only', async () => {
    project = levelExportTestProjectCreate(
      levelWorldCreate().world,
      { tool_textures: { nodraw: [NODRAW_TEXTURE] } },
      classes,
    );
    await run(project);
    const files = filesRead(project.levelDirectory);
    const collision = JSON.parse(files.get(COLLISION_FILE_NAME)?.toString('utf8') ?? '{}') as CollisionDocument;
    const zonePieces = collision.pieces.filter((piece) => ZONE_CLASS in piece.components);
    expect(zonePieces.length).toBeGreaterThan(0);
    expect(zonePieces.every((piece) => piece.kind === 'volume')).toBe(true);
    expect(collision.pieces.some((piece) => piece.planes.some((plane) => plane.texture === NODRAW_TEXTURE))).toBe(true);
    const glb = files.get(LEVEL_BUILD_GEOMETRY_FILE_NAME) ?? Buffer.alloc(0);
    const materials = levelBuildGlbMaterialIdsRead(new Uint8Array(glb));
    expect(materials).toContain(WALL_TEXTURE);
    expect(materials).not.toContain(NODRAW_TEXTURE);
    expect(glb.toString('latin1')).toContain(COLLISION_EXPORT_EXTRAS_KEY);
  });

  it('reads a turned player start back with its rotation and its class defaults', async () => {
    const level = levelWorldCreate();
    project = levelExportTestProjectCreate(level.world, {}, classes);
    await run(project);
    const collision = JSON.parse(
      readFileSync(join(project.levelDirectory, COLLISION_FILE_NAME), 'utf8'),
    ) as CollisionDocument;
    const placement = collision.placements.find((candidate) => candidate.object_id === level.start.uuid);
    const expected = level.start.getWorldQuaternion(new THREE.Quaternion());
    const read = new THREE.Quaternion(...(placement?.rotation ?? [0, 0, 0, 1])).normalize();
    expect(read.angleTo(expected)).toBeLessThan(1e-5);
    expect(placement?.position).toEqual(level.start.position.toArray());
    expect(placement?.components[START_CLASS]).toEqual({ team: 'red' });
  });

  it('names the levels it knows when asked for an unknown one', async () => {
    project = levelExportTestProjectCreate(levelWorldCreate().world);
    const result = await LevelExportRunner.run({
      projectFile: project.projectFile,
      levelId: 'missing',
      outDirectory: null,
      isCheck: false,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('missing');
  });
});
