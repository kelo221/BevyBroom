import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { CollisionKindStore } from '@/level_export/kind/collision_kind_store.js';
import { CommandSolidBrushGameComponentsDetach } from '@/solid/commands/brush/command_solid_brush_game_components_detach.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';

/** Component the tests put on a brush. */
const DETACH_TEST_COMPONENT = 'detach_test::Zone';

/**
 * Builds a world with one solid model of two brushes, the second moved away
 * from the first and carrying a component and a collision kind.
 *
 * @returns World, model, the plain brush and the brush with the component.
 */
function worldCreate(): { world: THREE.Group; model: SolidModel; plain: THREE.Mesh; tagged: THREE.Mesh } {
  const world = new THREE.Group();
  const model = new SolidModel('DetachWorld');
  const plain = model.addBoxBrush(2, SolidOperation.Additive).mesh;
  const tagged = model.addBoxBrush(1, SolidOperation.Subtractive).mesh;
  if (!plain || !tagged) {
    throw new Error('brushes have no mesh');
  }
  tagged.position.set(5, 1, -3);
  model.root.position.set(1, 0, 2);
  world.add(model.root);
  GameEntityComponentStore.write(tagged, { [DETACH_TEST_COMPONENT]: { size: 3 } });
  CollisionKindStore.overrideWrite(tagged, 'volume');
  world.updateMatrixWorld(true);
  return { world, model, plain, tagged };
}

/**
 * Returns the world-space bounds of an object's meshes.
 *
 * @param object Object to measure.
 * @returns World bounds.
 */
function worldBoundsRead(object: THREE.Object3D): THREE.Box3 {
  object.updateWorldMatrix(true, true);
  return new THREE.Box3().setFromObject(object);
}

/** Brushes with game components move into solid models of their own. */
describe('CommandSolidBrushGameComponentsDetach', () => {
  it('builds nothing when no brush carries components', () => {
    const { world, tagged } = worldCreate();
    GameEntityComponentStore.write(tagged, {});
    expect(CommandSolidBrushGameComponentsDetach.createForWorld(world)).toBeNull();
  });

  it('moves the brush into an additive model of its own that holds its components, kind, name and uuid', () => {
    const { world, model, plain, tagged } = worldCreate();
    const taggedBounds = worldBoundsRead(tagged);
    const command = CommandSolidBrushGameComponentsDetach.createForWorld(world);
    command?.execute();
    const [created] = command?.createdModelsRead() ?? [];
    if (!created) {
      throw new Error('expected a created model');
    }
    expect(created.root.parent).toBe(world);
    expect([created.root.uuid, created.root.name]).toEqual([tagged.uuid, tagged.name]);
    expect(GameEntityComponentStore.read(created.root)).toEqual(GameEntityComponentStore.read(tagged));
    expect(CollisionKindStore.overrideRead(created.root)).toBe('volume');
    expect(created.getBrushes().map((brush) => brush.operation)).toEqual([SolidOperation.Additive]);
    expect(model.getBrushes().map((brush) => brush.mesh)).toEqual([plain]);
    const createdBrushMesh = created.getBrushes()[0]?.mesh ?? new THREE.Mesh();
    const createdBounds = worldBoundsRead(createdBrushMesh);
    expect(createdBounds.min.distanceTo(taggedBounds.min)).toBeLessThan(1e-6);
    expect(createdBounds.max.distanceTo(taggedBounds.max)).toBeLessThan(1e-6);
  });

  it('puts the brush back and removes the new model on undo', () => {
    const { world, model, plain, tagged } = worldCreate();
    const command = CommandSolidBrushGameComponentsDetach.createForWorld(world);
    command?.execute();
    command?.undo();
    command?.createdModelsRelease();
    expect(world.children).toEqual([model.root]);
    expect(model.getBrushes().map((brush) => brush.mesh)).toEqual([plain, tagged]);
    expect(GameEntityComponentStore.hasAny(tagged)).toBe(true);
  });
});
