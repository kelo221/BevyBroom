import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ClipboardPlacementAim } from '@/clipboard/placement/clipboard_placement_cursor.js';
import { EntityVisualBuilder } from '@/entity/visual/entity_visual_builder.js';
import { EntityVisualPointBox } from '@/entity/visual/entity_visual_point_box.js';
import type { EntityPointBoxShape } from '@/entity/visual/entity_visual_point_box_geometry.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { entityPlacementSurfaceRestingApply } from '@/tools/creation/placement/entity_placement_surface_resting.js';

/** Grid step used by the placements. */
const GRID_INTERVAL = 0.25;

/** Marker box standing on the entity origin, like a player start. */
const FEET_BOX_SHAPE: EntityPointBoxShape = { size: [0.5, 1.5, 0.5], offset: [0, 0.75, 0] };

/**
 * Creates a world holding one floor slab whose top face sits at a height.
 *
 * @param floorTop Height of the slab's top face.
 * @returns World root and the slab.
 */
function worldWithFloorCreate(floorTop: number): { world: THREE.Group; floor: THREE.Mesh } {
  const world = new THREE.Group();
  const slabHeight = 0.5;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(40, slabHeight, 40), new THREE.MeshBasicMaterial());
  floor.position.set(0, floorTop - slabHeight / 2, 0);
  world.add(floor);
  world.updateMatrixWorld(true);
  return { world, floor };
}

/**
 * Creates a game entity whose marker box has a given shape.
 *
 * @param shape Marker box shape.
 * @returns New game entity owner.
 */
function gameEntityWithShapeCreate(shape: EntityPointBoxShape): THREE.Group {
  const owner = GameEntityOwner.createDefault('Probe');
  EntityVisualPointBox.shapeApply(owner, shape, 'Probe Marker');
  return owner;
}

/**
 * Builds an aim at a world point from a camera placed at an offset from it.
 *
 * @param target Aimed world point.
 * @param cameraOffset Camera position relative to the target.
 * @returns Aim through the target.
 */
function aimAtPointCreate(target: THREE.Vector3, cameraOffset: THREE.Vector3): ClipboardPlacementAim {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.copy(target).add(cameraOffset);
  camera.lookAt(target.clone().add(new THREE.Vector3(1.3, 0, -0.7)));
  camera.updateMatrixWorld(true);
  const projected = target.clone().project(camera);
  return { camera, ndc: new THREE.Vector2(projected.x, projected.y) };
}

/**
 * Returns the world bounds of an owner's marker box.
 *
 * @param owner Entity owner in the world.
 * @returns World bounds.
 */
function markerWorldBoundsRead(owner: THREE.Object3D): THREE.Box3 {
  owner.updateMatrixWorld(true);
  const marker = EntityVisualBuilder.markerFind(owner);
  if (!marker) throw new Error('owner has a marker');
  return new THREE.Box3().setFromObject(marker);
}

/**
 * Entities placed with the Entity tool stand on the brush under the aimed
 * point: the bottom of their marker box touches the surface and their origin
 * stays on the grid across it.
 */
describe('entityPlacementSurfaceRestingApply', () => {
  it('rests the marker box on the surface under the aim with the origin on the grid', () => {
    const floorTop = 1.75;
    const { world } = worldWithFloorCreate(floorTop);
    const target = new THREE.Vector3(2.4, floorTop, -3.1);
    const owner = gameEntityWithShapeCreate(FEET_BOX_SHAPE);
    entityPlacementSurfaceRestingApply(
      owner,
      aimAtPointCreate(target, new THREE.Vector3(-4, 6, 5)),
      world,
      GRID_INTERVAL,
    );
    world.add(owner);
    expect(markerWorldBoundsRead(owner).min.y).toBeCloseTo(floorTop, 6);
    expect(Math.abs(owner.position.x - target.x)).toBeLessThanOrEqual(GRID_INTERVAL / 2 + 1e-9);
    expect(Math.abs(owner.position.z - target.z)).toBeLessThanOrEqual(GRID_INTERVAL / 2 + 1e-9);
    expect((owner.position.x / GRID_INTERVAL) % 1).toBeCloseTo(0, 6);
    expect((owner.position.z / GRID_INTERVAL) % 1).toBeCloseTo(0, 6);
  });

  it('looks through the markers of other entities to the brush behind them', () => {
    const floorTop = 0.5;
    const { world } = worldWithFloorCreate(floorTop);
    const target = new THREE.Vector3(-1.2, floorTop, 0.9);
    const aim = aimAtPointCreate(target, new THREE.Vector3(3, 5, 4));
    const blocker = gameEntityWithShapeCreate({ size: [2, 2, 2], offset: [0, 0, 0] });
    blocker.position.copy(target).lerp(aim.camera.position, 0.3);
    world.add(blocker);
    world.updateMatrixWorld(true);
    const owner = gameEntityWithShapeCreate(FEET_BOX_SHAPE);
    entityPlacementSurfaceRestingApply(owner, aim, world, GRID_INTERVAL);
    world.add(owner);
    expect(markerWorldBoundsRead(owner).min.y).toBeCloseTo(floorTop, 6);
  });

  it('places the origin in the local space of a moved world root', () => {
    const floorTop = 1;
    const { world } = worldWithFloorCreate(floorTop);
    const worldShift = new THREE.Vector3(0.5, 2, -1);
    world.position.copy(worldShift);
    world.updateMatrixWorld(true);
    const target = new THREE.Vector3(0.6, floorTop, 1.4).add(worldShift);
    const owner = gameEntityWithShapeCreate(FEET_BOX_SHAPE);
    entityPlacementSurfaceRestingApply(
      owner,
      aimAtPointCreate(target, new THREE.Vector3(2, 7, 3)),
      world,
      GRID_INTERVAL,
    );
    world.add(owner);
    expect(markerWorldBoundsRead(owner).min.y).toBeCloseTo(target.y, 6);
    expect(owner.position.y).toBeCloseTo(floorTop, 6);
  });
});
