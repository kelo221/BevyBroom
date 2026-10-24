import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PreviewE2eGameProcess, previewE2eProjectCopy, previewE2eProjectRemove } from './preview_e2e_game_process.js';
import { PreviewE2eRig } from './preview_e2e_rig.js';
import { e2eWindowsShownRead, previewE2eEnvironmentRead } from './preview_e2e_environment.js';
import { previewE2eEntityRowsQuery, type PreviewE2eEntityRow } from './preview_e2e_game_query.js';

/**
 * End-to-end acceptance of level culling bounds: a mesh whose two material
 * parts share one vertex buffer reaches the game as two primitives, and each
 * gets the bounding box of its own part instead of the whole buffer's. Skipped
 * unless BROOM_E2E_PREVIEW_EXE and BROOM_E2E_PROJECT_DIR are set.
 */
const environment = previewE2eEnvironmentRead(15);
const STEP_TIMEOUT_MILLISECONDS = 60000;
const AABB_COMPONENT = 'bevy_camera::primitives::Aabb';
const TIGHT_BOUNDS_COMPONENT = 'broom_bridge::level::bounds::TightBounds';
/** Distance between the two one-meter cubes of the split mesh. */
const PART_DISTANCE = 20;

/** A box as center and half extents. */
interface Bounds {
  center: number[];
  halfExtents: number[];
}

/**
 * Creates one mesh of two one-meter cubes twenty meters apart, each drawn with
 * its own material, so the export writes two primitives over one vertex list.
 *
 * @returns The mesh.
 */
function splitMeshCreate(): THREE.Mesh {
  const near = new THREE.BoxGeometry(1, 1, 1);
  const far = new THREE.BoxGeometry(1, 1, 1).translate(PART_DISTANCE, 0, 0);
  const geometry = mergeGeometries([near, far], true);
  const materials = [
    new THREE.MeshStandardMaterial({ color: 0xff0000 }),
    new THREE.MeshStandardMaterial({ color: 0x0000ff }),
  ];
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.name = 'Split parts';
  return mesh;
}

/**
 * Reads a vector the remote protocol serialized as an array or as x, y, z.
 *
 * @param value Serialized vector.
 * @returns Its three components.
 */
function vectorRead(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map(Number);
  }
  const vector = value as { x: number; y: number; z: number };
  return [vector.x, vector.y, vector.z];
}

/**
 * Returns the bounds of the game's level primitives, nearest part first.
 *
 * @param rows Rows of a query for boxes, with the tight bounds marker reported.
 * @returns Bounds of rows carrying the marker, sorted by center x.
 */
function levelBoundsRead(rows: PreviewE2eEntityRow[]): Bounds[] {
  return rows
    .filter((row) => row.has?.[TIGHT_BOUNDS_COMPONENT] === true)
    .map((row) => {
      const aabb = row.components[AABB_COMPONENT] as { center: unknown; half_extents: unknown };
      return { center: vectorRead(aabb.center), halfExtents: vectorRead(aabb.half_extents) };
    })
    .sort((left, right) => (left.center[0] ?? 0) - (right.center[0] ?? 0));
}

describe.skipIf(!environment.isConfigured)('level culling bounds end to end', () => {
  let projectDirectory = '';
  let game: PreviewE2eGameProcess;
  let rig: PreviewE2eRig;

  beforeAll(() => {
    projectDirectory = previewE2eProjectCopy(environment.sourceProjectDirectory);
    game = new PreviewE2eGameProcess(
      environment.previewExecutable,
      projectDirectory,
      environment.bridgePort,
      e2eWindowsShownRead(),
    );
    game.start();
    const world = new THREE.Group();
    world.add(splitMeshCreate());
    rig = new PreviewE2eRig(world, environment.endpoint, 'bounds_level');
  });

  afterAll(async () => {
    rig?.controller.disconnect();
    await game?.stop();
    if (projectDirectory !== '') {
      previewE2eProjectRemove(projectDirectory);
    }
  });

  it(
    'gives each material part of a shared-buffer mesh the bounding box of its own part',
    async () => {
      await rig.until('the split mesh in the game', (view) => rig.isCaughtUp(view), STEP_TIMEOUT_MILLISECONDS);
      const end = performance.now() + STEP_TIMEOUT_MILLISECONDS;
      let bounds: Bounds[] = [];
      let lastQuery: unknown = null;
      while (bounds.length !== 2 && performance.now() < end) {
        await rig.run(250);
        try {
          const rows = await previewE2eEntityRowsQuery(rig.transport, [AABB_COMPONENT], [TIGHT_BOUNDS_COMPONENT]);
          lastQuery = rows;
          bounds = levelBoundsRead(rows);
        } catch (error) {
          lastQuery = String(error);
        }
      }
      expect(bounds, `last query: ${JSON.stringify(lastQuery)}`).toHaveLength(2);
      const [near, far] = bounds;
      near?.center.forEach((value, axis) => expect(value).toBeCloseTo([0, 0, 0][axis] ?? 0, 4));
      far?.center.forEach((value, axis) => expect(value).toBeCloseTo([PART_DISTANCE, 0, 0][axis] ?? 0, 4));
      for (const part of bounds) {
        part.halfExtents.forEach((value) => expect(value).toBeCloseTo(0.5, 4));
      }
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );
});
