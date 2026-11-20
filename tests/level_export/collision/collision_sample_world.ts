import * as THREE from 'three';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { CollisionKindStore } from '@/level_export/kind/collision_kind_store.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { collisionTestModelCreate } from './collision_test_models.js';
import { collisionTestBoxMeshCreate } from './mesh/collision_mesh_test_boxes.js';
import {
  PROCEDURAL_GENERATOR_PEOPLE_MOVER_ID,
  PROCEDURAL_PEOPLE_MOVER_END,
  PROCEDURAL_PEOPLE_MOVER_START,
} from '@/procedural/generator/people_mover/procedural_generator_people_mover.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import { ProceduralSettingsRules } from '@/procedural/model/procedural_settings_rules.js';

/** Level name of the shared collision sample. */
export const COLLISION_SAMPLE_LEVEL_NAME = 'collision_sample';

/**
 * Builds the world the shared `collision_sample.json` fixture was written from:
 * a room carved out of a block, a volume zone, a turned Add > Box crate with a
 * game component and a turned spawn point, with fixed ids so the document is
 * the same every time.
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
  const crate = collisionTestBoxMeshCreate({
    size: new THREE.Vector3(1, 0.5, 0.5),
    position: new THREE.Vector3(-3, 0.25, 1),
    rotation: new THREE.Euler(0, Math.PI / 4, 0),
    texture: 'textures/crate.png',
  });
  crate.uuid = 'sample-crate';
  crate.name = 'Crate';
  GameEntityComponentStore.write(crate, { 'sample_game::Pushable': { mass: 20 } });
  const spawn = GameEntityOwner.createDefault('Spawn');
  spawn.uuid = 'sample-spawn';
  spawn.position.set(0.5, 0.25, -0.5);
  spawn.rotation.set(0, Math.PI / 2, 0);
  GameEntityComponentStore.write(spawn, { 'sample_game::Spawn': { team: 'blue' } });
  world.add(room.root, zone.root, crate, spawn, collisionSampleMoverCreate());
  world.updateMatrixWorld(true);
  return world;
}

/**
 * Builds the sample's travelator, a people mover rising gently along +X.
 *
 * @returns Procedural owner with a fixed id.
 */
function collisionSampleMoverCreate(): THREE.Group {
  const generator = ProceduralGeneratorRegistry.find(PROCEDURAL_GENERATOR_PEOPLE_MOVER_ID);
  if (generator === null) {
    throw new Error('the people mover is built in');
  }
  const settings = ProceduralSettingsRules.createForGenerator(generator);
  const mover = ProceduralOwner.create('Mover', {
    ...settings,
    parameters: generator.parametersSanitize({
      ...settings.parameters,
      [PROCEDURAL_PEOPLE_MOVER_START]: [0, 0, 0],
      [PROCEDURAL_PEOPLE_MOVER_END]: [4, 0.5, 0],
    }),
  });
  mover.uuid = 'sample-mover';
  mover.position.set(-6, 0, -3);
  return mover;
}
