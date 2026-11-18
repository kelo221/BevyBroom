import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { CollisionDocumentBuilder } from '@/level_export/collision/collision_document_builder.js';
import { COLLISION_FILE_VERSION } from '@/level_export/collision/collision_types.js';
import { CollisionKindStore } from '@/level_export/kind/collision_kind_store.js';
import { LayerManager } from '@/layer/model/layer_manager.js';
import { COLLISION_SAMPLE_LEVEL_NAME, collisionSampleWorldCreate } from './collision_sample_world.js';
import { collisionTestBoxMeshCreate } from './mesh/collision_mesh_test_boxes.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';

/**
 * The collision document gathers the pieces of every solid model and plain
 * content mesh, and the placements.
 */
describe('CollisionDocumentBuilder', () => {
  it('writes exactly the shared sample the bridge reads', () => {
    const sample = JSON.parse(readFileSync(join(process.cwd(), 'bevy/fixtures/collision_sample.json'), 'utf8'));
    const built = CollisionDocumentBuilder.build(collisionSampleWorldCreate(), COLLISION_SAMPLE_LEVEL_NAME);
    expect(JSON.parse(JSON.stringify(built))).toEqual(sample);
    expect(built.collision_version).toBe(COLLISION_FILE_VERSION);
  });

  it('gives every piece of a solid model the model kind, name and id', () => {
    const world = collisionSampleWorldCreate();
    const built = CollisionDocumentBuilder.build(world, COLLISION_SAMPLE_LEVEL_NAME);
    const roots = world.children.filter((child) => built.pieces.some((piece) => piece.object_id === child.uuid));
    expect(roots.length).toBeGreaterThan(1);
    for (const root of roots) {
      const pieces = built.pieces.filter((piece) => piece.object_id === root.uuid);
      expect(pieces.every((piece) => piece.object_name === root.name)).toBe(true);
      expect(pieces.every((piece) => piece.kind === CollisionKindStore.resolve(root))).toBe(true);
    }
  });

  it('leaves out solid models in layers left out of exports', () => {
    const world = collisionSampleWorldCreate();
    const omitted = world.children.find((child) => child.name === 'Finish') ?? new THREE.Object3D();
    const layers = new LayerManager(world);
    const layer = layers.layerDefinitionAllocate();
    layers.layerInsert(layer, layers.layersList().length);
    layers.layerFlagSet(layer.id, 'omitFromExport', true);
    layers.objectsLayerAssign([omitted], layer.id);
    const built = CollisionDocumentBuilder.build(world, COLLISION_SAMPLE_LEVEL_NAME);
    expect(built.pieces.some((piece) => piece.object_id === omitted.uuid)).toBe(false);
    expect(built.pieces.length).toBeGreaterThan(0);
  });

  it('gives a plain box mesh one piece with its id, name, kind and components', () => {
    const world = new THREE.Group();
    const mesh = collisionTestBoxMeshCreate({
      size: new THREE.Vector3(1, 2, 1),
      position: new THREE.Vector3(2, 1, 0),
      rotation: new THREE.Euler(0, 0.4, 0),
    });
    mesh.name = 'Finish Zone';
    GameEntityComponentStore.write(mesh, { 'sample_game::Finish': { lap: 1 } });
    CollisionKindStore.overrideWrite(mesh, 'volume');
    world.add(mesh);
    const built = CollisionDocumentBuilder.build(world, COLLISION_SAMPLE_LEVEL_NAME);
    expect(built.pieces).toHaveLength(1);
    expect(built.pieces[0]).toMatchObject({
      object_id: mesh.uuid,
      object_name: 'Finish Zone',
      kind: 'volume',
      components: { 'sample_game::Finish': { lap: 1 } },
    });
    expect(built.flagged).toEqual([]);
  });
});
