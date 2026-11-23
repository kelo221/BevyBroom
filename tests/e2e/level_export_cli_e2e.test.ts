import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import { COLLISION_FILE_NAME, type CollisionDocument } from '@/level_export/collision/collision_types.js';
import { CollisionKindStore } from '@/level_export/kind/collision_kind_store.js';
import { PreviewLinkTransportHttp } from '@/preview/link/preview_link_transport.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import {
  collisionTestModelCreate,
  collisionTestPieceContains,
  collisionTestSamples,
} from '../level_export/collision/collision_test_models.js';
import {
  collisionTestBoxCornersWorld,
  collisionTestBoxMeshCreate,
} from '../level_export/collision/mesh/collision_mesh_test_boxes.js';
import { PreviewE2eGameProcess, previewE2eProjectCopy, previewE2eProjectRemove } from './preview_e2e_game_process.js';
import { previewE2eSleep } from './preview_e2e_rig.js';
import { e2eWindowsShownRead, previewE2eEnvironmentRead } from './preview_e2e_environment.js';
import { previewE2eEntityRowsQuery } from './preview_e2e_game_query.js';
import {
  TEST_SHELF_RUN_LIST_PATH,
  TEST_SHELF_RUN_RENAMES,
  TEST_SHELF_RUN_TYPE_PATH,
  TEST_SHELF_RUN_VARIANTS,
  testShelfRunClassJson,
} from '../game_entity/game_entity_test_class_enum_list.js';

/**
 * End-to-end acceptance of the command-line level export: a level document in a
 * temporary copy of the sample project is exported with `bun
 * scripts/level_export.ts`, twice with the same bytes, `--check` passes, the
 * collision pieces are the room's walls with nothing inside it, a volume is in
 * the collision but not drawn, an Add > Box crate with a game component is one
 * piece of its kind, the volume's enum list from the project's class file keeps
 * its order with old names renamed, a turned spawn keeps its rotation, and the
 * game loads the exported level with `--level` and shows the room. Skipped
 * unless BROOM_E2E_PREVIEW_EXE and BROOM_E2E_PROJECT_DIR are set; its game
 * listens thirty ports above BROOM_E2E_PORT.
 */
const environment = previewE2eEnvironmentRead(30);
const STEP_TIMEOUT_MILLISECONDS = 60000;
const LEVEL_ID = 'e2e_export_room';
const AABB_COMPONENT = 'bevy_camera::primitives::Aabb';
const TIGHT_BOUNDS_COMPONENT = 'broom_bridge::level::bounds::TightBounds';

/** The room block, the carved room and the volume zone inside it. */
const OUTER = new THREE.Box3(new THREE.Vector3(-4, 0, -3), new THREE.Vector3(4, 3, 3));
const ROOM = new THREE.Box3(new THREE.Vector3(-3.5, 0.25, -2.5), new THREE.Vector3(3.5, 2.75, 2.5));
const ZONE = new THREE.Box3(new THREE.Vector3(1, 0.25, 1), new THREE.Vector3(2, 1.25, 2));

/**
 * Class file the project copy declares, holding the enum list class the zone
 * carries.
 */
const CLASS_FILE = 'broom/e2e-entity-classes.json';

/** An old category name and the name the class file renames it to. */
const [ZONE_OLD_CATEGORY = '', ZONE_RENAMED_CATEGORY = ''] = Object.entries(TEST_SHELF_RUN_RENAMES)[0] ?? [];

/** Categories the zone holds, in order, the old name in the middle. */
const ZONE_CATEGORIES = [TEST_SHELF_RUN_VARIANTS.at(-1) ?? '', ZONE_OLD_CATEGORY, TEST_SHELF_RUN_VARIANTS[0] ?? ''];

/** The Add > Box crate outside the room, and the game component it carries. */
const CRATE_SIZE = new THREE.Vector3(1, 0.5, 0.75);
const CRATE_POSITION = new THREE.Vector3(7, 0.25, 0);
const CRATE_COMPONENT = 'e2e_game::Pushable';

/**
 * Builds the level: a room carved out of a block, a volume zone holding an enum
 * list, a turned Add > Box crate with a game component and a turned spawn
 * point.
 *
 * @returns World, spawn, crate and zone.
 */
function levelWorldCreate(): { world: THREE.Group; spawn: THREE.Group; crate: THREE.Mesh; zone: THREE.Object3D } {
  const world = new THREE.Group();
  const room = collisionTestModelCreate([
    { box: OUTER, operation: SolidOperation.Additive },
    { box: ROOM, operation: SolidOperation.Subtractive },
  ]);
  const zone = collisionTestModelCreate([{ box: ZONE, operation: SolidOperation.Additive }]);
  CollisionKindStore.overrideWrite(zone.root, 'volume');
  GameEntityComponentStore.write(zone.root, {
    [TEST_SHELF_RUN_TYPE_PATH]: { [TEST_SHELF_RUN_LIST_PATH]: ZONE_CATEGORIES },
  });
  const spawn = GameEntityOwner.createDefault('Spawn');
  spawn.position.set(-2, 0.25, 0);
  spawn.rotation.set(0, Math.PI / 3, 0);
  const crate = collisionTestBoxMeshCreate({
    size: CRATE_SIZE,
    position: CRATE_POSITION,
    rotation: new THREE.Euler(0, Math.PI / 6, 0),
  });
  GameEntityComponentStore.write(crate, { [CRATE_COMPONENT]: { mass: 5 } });
  world.add(room.root, zone.root, spawn, crate);
  world.updateMatrixWorld(true);
  return { world, spawn, crate, zone: zone.root };
}

/**
 * Declares the enum list test class in a class file of the project copy and
 * names that file in the copy's project file.
 *
 * @param projectDirectory Project copy.
 */
function projectClassFileWrite(projectDirectory: string): void {
  writeFileSync(join(projectDirectory, CLASS_FILE), JSON.stringify({ classes: [testShelfRunClassJson()] }));
  const projectFile = join(projectDirectory, 'broom.project.json');
  const project = JSON.parse(readFileSync(projectFile, 'utf8')) as Record<string, unknown>;
  writeFileSync(projectFile, JSON.stringify({ ...project, entity_classes: CLASS_FILE }, null, 2));
}

/**
 * Reads a vector the remote protocol serialized as an array or as x, y, z.
 *
 * @param value Serialized vector.
 * @returns The vector.
 */
function vectorRead(value: unknown): THREE.Vector3 {
  if (Array.isArray(value)) {
    return new THREE.Vector3(Number(value[0]), Number(value[1]), Number(value[2]));
  }
  const vector = value as { x: number; y: number; z: number };
  return new THREE.Vector3(vector.x, vector.y, vector.z);
}

/**
 * Runs the command-line export.
 *
 * @param projectDirectory Project directory.
 * @param extraArguments More arguments, such as `--check`.
 * @returns Exit status and output.
 */
function exportRun(projectDirectory: string, extraArguments: string[] = []): { status: number | null; output: string } {
  const result = spawnSync(
    'bun',
    [
      'scripts/level_export.ts',
      '--project',
      join(projectDirectory, 'broom.project.json'),
      '--level',
      LEVEL_ID,
      ...extraArguments,
    ],
    { cwd: process.cwd(), encoding: 'utf8', timeout: STEP_TIMEOUT_MILLISECONDS },
  );
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe.skipIf(!environment.isConfigured)('command-line level export end to end', () => {
  let projectDirectory = '';
  let levelDirectory = '';
  let spawn: THREE.Group;
  let crate: THREE.Mesh;
  let zone: THREE.Object3D;

  beforeAll(() => {
    projectDirectory = previewE2eProjectCopy(environment.sourceProjectDirectory);
    const level = levelWorldCreate();
    spawn = level.spawn;
    crate = level.crate;
    zone = level.zone;
    mkdirSync(join(projectDirectory, 'broom/documents'), { recursive: true });
    projectClassFileWrite(projectDirectory);
    writeFileSync(
      join(projectDirectory, 'broom/documents', `${LEVEL_ID}.json`),
      JSON.stringify(new SceneSerializer().serialize(level.world)),
    );
    levelDirectory = join(projectDirectory, 'assets/broom/levels', LEVEL_ID);
  });

  afterAll(() => {
    if (projectDirectory !== '') {
      previewE2eProjectRemove(projectDirectory);
    }
  });

  /**
   * Reads the files of the exported level.
   *
   * @returns Bytes by file name.
   */
  function filesRead(): Map<string, Buffer> {
    return new Map(readdirSync(levelDirectory).map((name) => [name, readFileSync(join(levelDirectory, name))]));
  }

  it(
    'exports the same bytes twice from separate processes and passes the check',
    () => {
      const first = exportRun(projectDirectory);
      expect(first.status, first.output).toBe(0);
      const files = filesRead();
      expect(exportRun(projectDirectory).status).toBe(0);
      expect(filesRead()).toEqual(files);
      const checked = exportRun(projectDirectory, ['--check']);
      expect(checked.status, checked.output).toBe(0);
    },
    STEP_TIMEOUT_MILLISECONDS * 3,
  );

  it(
    'writes the room walls as convex pieces, the zone as a volume and the spawn with its rotation',
    () => {
      const collision = JSON.parse(
        readFileSync(join(levelDirectory, COLLISION_FILE_NAME), 'utf8'),
      ) as CollisionDocument;
      const solid = collision.pieces.filter((piece) => piece.kind === 'solid');
      const wrong = collisionTestSamples(OUTER.clone().expandByScalar(0.5), 0.5).filter((point) => {
        const isWall = OUTER.containsPoint(point) && !ROOM.containsPoint(point);
        return solid.some((piece) => collisionTestPieceContains(piece, point)) !== isWall;
      });
      expect(wrong).toEqual([]);
      expect(collision.pieces.some((piece) => piece.kind === 'volume')).toBe(true);
      const placement = collision.placements.find((candidate) => candidate.object_id === spawn.uuid);
      const rotation = new THREE.Quaternion(...(placement?.rotation ?? [0, 0, 0, 1])).normalize();
      expect(rotation.angleTo(spawn.quaternion)).toBeLessThan(1e-5);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'writes the Add > Box crate as one solid piece holding exactly its box, with its component',
    () => {
      const collision = JSON.parse(
        readFileSync(join(levelDirectory, COLLISION_FILE_NAME), 'utf8'),
      ) as CollisionDocument;
      const pieces = collision.pieces.filter((piece) => piece.object_id === crate.uuid);
      expect(pieces).toHaveLength(1);
      const piece = pieces[0];
      if (!piece) throw new Error('missing crate piece');
      expect(piece.kind).toBe('solid');
      expect(piece.components[CRATE_COMPONENT]).toMatchObject({ mass: 5 });
      const corners = collisionTestBoxCornersWorld(crate, CRATE_SIZE);
      corners.forEach((corner) => expect(collisionTestPieceContains(piece, corner)).toBe(true));
      corners.forEach((corner) => {
        const beyond = corner.clone().sub(CRATE_POSITION).multiplyScalar(1.05).add(CRATE_POSITION);
        expect(collisionTestPieceContains(piece, beyond)).toBe(false);
      });
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'writes the zone’s enum list in its order with the old category renamed, as the class file declares',
    () => {
      const collision = JSON.parse(
        readFileSync(join(levelDirectory, COLLISION_FILE_NAME), 'utf8'),
      ) as CollisionDocument;
      const pieces = collision.pieces.filter((piece) => piece.object_id === zone.uuid);
      expect(pieces.length).toBeGreaterThan(0);
      const expected = ZONE_CATEGORIES.map((category) =>
        category === ZONE_OLD_CATEGORY ? ZONE_RENAMED_CATEGORY : category,
      );
      pieces.forEach((piece) => {
        expect(piece.kind).toBe('volume');
        expect(piece.components[TEST_SHELF_RUN_TYPE_PATH]?.[TEST_SHELF_RUN_LIST_PATH]).toEqual(expected);
      });
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'loads the exported level in the game, which shows the room and not the volume',
    async () => {
      const game = new PreviewE2eGameProcess(
        environment.previewExecutable,
        projectDirectory,
        environment.bridgePort,
        e2eWindowsShownRead(),
        ['--level', LEVEL_ID],
      );
      game.start();
      try {
        await gameBoundsWait(new PreviewLinkTransportHttp(environment.endpoint));
      } finally {
        await game.stop();
      }
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  /**
   * Waits until the game's level geometry is exactly the room block: one drawn
   * box spanning the outer block and none spanning the zone.
   *
   * @param transport Transport to the game.
   */
  async function gameBoundsWait(transport: PreviewLinkTransportHttp): Promise<void> {
    const end = performance.now() + STEP_TIMEOUT_MILLISECONDS;
    let boxes: THREE.Box3[] = [];
    while (performance.now() < end) {
      const rows = await previewE2eEntityRowsQuery(transport, [AABB_COMPONENT], [TIGHT_BOUNDS_COMPONENT]).catch(
        () => [],
      );
      boxes = rows
        .filter((row) => row.has?.[TIGHT_BOUNDS_COMPONENT] === true)
        .map((row) => {
          const aabb = row.components[AABB_COMPONENT] as { center: unknown; half_extents: unknown };
          return new THREE.Box3().setFromCenterAndSize(
            vectorRead(aabb.center),
            vectorRead(aabb.half_extents).multiplyScalar(2),
          );
        });
      if (boxes.some((box) => box.min.distanceTo(OUTER.min) < 1e-3 && box.max.distanceTo(OUTER.max) < 1e-3)) {
        expect(boxes.some((box) => box.min.distanceTo(ZONE.min) < 1e-3 && box.max.distanceTo(ZONE.max) < 1e-3)).toBe(
          false,
        );
        return;
      }
      await previewE2eSleep(250);
    }
    throw new Error(`Timed out waiting for the room in the game; boxes: ${JSON.stringify(boxes)}`);
  }
});
