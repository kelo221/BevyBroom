import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LayerManager } from '@/layer/model/layer_manager.js';
import { LevelExportObjectFilter } from '@/level_export/level_export_object_filter.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { collisionTestModelCreate } from './collision/collision_test_models.js';

/**
 * Level exports keep hidden objects, leave out omitted layers and tell plain
 * content meshes apart.
 */
describe('LevelExportObjectFilter', () => {
  it('keeps hidden objects and drops objects in layers left out of exports', () => {
    const world = new THREE.Group();
    const layers = new LayerManager(world);
    const hidden = new THREE.Group();
    hidden.visible = false;
    const omitted = new THREE.Group();
    const child = new THREE.Group();
    omitted.add(child);
    world.add(hidden, omitted);
    const layer = layers.layerDefinitionAllocate();
    layers.layerInsert(layer, layers.layersList().length);
    layers.layerFlagSet(layer.id, 'omitFromExport', true);
    layers.objectsLayerAssign([omitted], layer.id);
    expect(LevelExportObjectFilter.exportedIs(hidden, world)).toBe(true);
    expect(LevelExportObjectFilter.exportedIs(child, world)).toBe(false);
  });

  it('counts meshes in groups as plain content meshes, but not solid model parts, entity parts or nested meshes', () => {
    const plain = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const nested = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    plain.add(nested);
    const folder = new THREE.Group();
    folder.add(plain);
    const model = collisionTestModelCreate([
      { box: new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1, 1, 1)), operation: SolidOperation.Additive },
    ]);
    const modelMeshes: THREE.Object3D[] = [];
    model.root.traverse((object) => (object instanceof THREE.Mesh ? modelMeshes.push(object) : undefined));
    const entity = GameEntityOwner.createDefault('Spawn');
    const entityMeshes: THREE.Object3D[] = [];
    entity.traverse((object) => (object instanceof THREE.Mesh ? entityMeshes.push(object) : undefined));
    expect(LevelExportObjectFilter.contentMeshIs(plain)).toBe(true);
    expect(LevelExportObjectFilter.contentMeshIs(nested)).toBe(false);
    expect(modelMeshes.length).toBeGreaterThan(0);
    expect(modelMeshes.some((mesh) => LevelExportObjectFilter.contentMeshIs(mesh))).toBe(false);
    expect(entityMeshes.some((mesh) => LevelExportObjectFilter.contentMeshIs(mesh))).toBe(false);
    expect(LevelExportObjectFilter.collisionSourceIs(model.root)).toBe(true);
    expect(LevelExportObjectFilter.collisionSourceIs(folder)).toBe(false);
  });
});
