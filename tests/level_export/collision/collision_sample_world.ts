import * as THREE from 'three';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { CollisionKindStore } from '@/level_export/kind/collision_kind_store.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { collisionTestModelCreate } from './collision_test_models.js';

/** Level name of the shared collision sample. */
export const COLLISION_SAMPLE_LEVEL_NAME = 'collision_sample';

/**
 * Builds the world the shared `collision_sample.json` fixture was written from:
 * a room carved out of a block, a volume zone and a turned spawn point, with
 * fixed ids so the document is the same every time.
 *
 * @returns Sample world.
 */
export function collisionSampleWorldCreate(): THREE.Group {
  const world = new THREE.Group();
  const room = collisionTestModelCreate([
    {
      box: new THREE.Box3(new THREE.Vector3(-2, 0, -2), new THREE.Vector3(2, 2, 2)),
      operation: SolidOperation.Additive,
      textureId: 'textures/brick.png',
    },
    {
      box: new THREE.Box3(new THREE.Vector3(-1.5, 0.25, -1.5), new THREE.Vector3(1.5, 1.75, 1.5)),
      operation: SolidOperation.Subtractive,
      textureId: 'textures/plaster.png',
    },
  ]);
  room.root.uuid = 'sample-room';
  room.root.name = 'Room';
  const zone = collisionTestModelCreate([
    { box: new THREE.Box3(new THREE.Vector3(3, 0, 3), new THREE.Vector3(4, 1, 4)), operation: SolidOperation.Additive },
  ]);
  zone.root.uuid = 'sample-zone';
  zone.root.name = 'Finish';
  CollisionKindStore.overrideWrite(zone.root, 'volume');
  const spawn = GameEntityOwner.createDefault('Spawn');
  spawn.uuid = 'sample-spawn';
  spawn.position.set(0.5, 0.25, -0.5);
  spawn.rotation.set(0, Math.PI / 2, 0);
  GameEntityComponentStore.write(spawn, { 'sample_game::Spawn': { team: 'blue' } });
  world.add(room.root, zone.root, spawn);
  world.updateMatrixWorld(true);
  return world;
}
