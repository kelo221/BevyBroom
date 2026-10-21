import * as THREE from 'three';
import type { LayerDefinition } from '@/layer/model/layer_definition.js';
import { LayerManager } from '@/layer/model/layer_manager.js';

/** A world root with its layer manager, built fresh for one test. */
export interface LayerTestWorld {
  world: THREE.Group;
  manager: LayerManager;
}

/**
 * Creates an empty world root bound to a new layer manager.
 *
 * @returns World and manager.
 */
export function layerTestWorldCreate(): LayerTestWorld {
  const world = new THREE.Group();
  return { world, manager: new LayerManager(world) };
}

/**
 * Creates a unit box mesh with a plain material.
 *
 * @param name Mesh name.
 * @returns New mesh, not added anywhere.
 */
export function layerTestBoxCreate(name: string): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mesh.name = name;
  return mesh;
}

/**
 * Adds a new layer at the end of a manager's list, without undo.
 *
 * @param manager Layer manager.
 * @param name Layer name.
 * @returns The added layer.
 */
export function layerTestLayerAdd(manager: LayerManager, name: string): LayerDefinition {
  const definition = manager.layerDefinitionAllocate();
  definition.name = name;
  manager.layerInsert(definition, manager.layersList().length);
  const added = manager.layerFind(definition.id);
  if (added === null) {
    throw new Error('The test layer was not added');
  }
  return added;
}

/**
 * Adds a box to the world while a layer is current, so the box joins it.
 *
 * @param testWorld World and manager.
 * @param layerIdentifier Layer the box joins.
 * @param name Box name.
 * @returns The added box.
 */
export function layerTestBoxAddToLayer(testWorld: LayerTestWorld, layerIdentifier: string, name: string): THREE.Mesh {
  const previousCurrent = testWorld.manager.currentLayerIdRead();
  testWorld.manager.currentLayerSet(layerIdentifier);
  const box = layerTestBoxCreate(name);
  testWorld.world.add(box);
  testWorld.manager.currentLayerSet(previousCurrent);
  return box;
}
