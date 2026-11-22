import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { entityPickMeshSelectableIs } from '@/entity/model/entity_owner_keys.js';
import { CommandEntityArrayBake } from '@/entity_array/commands/command_entity_array_bake.js';
import { EntityArrayCopyMark } from '@/entity_array/model/entity_array_copy_mark.js';
import { EntityArraySettingsRules } from '@/entity_array/model/entity_array_settings.js';
import { EntityArrayStore } from '@/entity_array/model/entity_array_store.js';
import {
  entityArrayTestPickMeshesOf,
  entityArrayTestRigCreate,
  entityArrayTestSettingsSet,
  entityArrayTestShelfPlace,
} from '../entity_array_test_rig.js';

/**
 * Returns the world position of every object, keyed by uuid.
 *
 * @param objects Objects to measure.
 * @returns Positions by uuid.
 */
function worldPositionsOf(objects: readonly THREE.Object3D[]): Map<string, THREE.Vector3> {
  return new Map(objects.map((object) => [object.uuid, object.getWorldPosition(new THREE.Vector3())]));
}

/** Baking turns the copies of an array into ordinary entities beside the source. */
describe('CommandEntityArrayBake', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('moves the copies beside the source where they stood, unmarked and clickable, and undoes it', () => {
    const rig = entityArrayTestRigCreate(cleanups);
    const shelf = entityArrayTestShelfPlace(rig, new THREE.Vector3(1, 0, 4));
    shelf.rotation.y = 0.5;
    entityArrayTestSettingsSet(rig, shelf, EntityArraySettingsRules.fromUnknown({ count_x: 3, gap: [0.5, 0, 0] }));
    const copies = EntityArrayCopyMark.copiesOf(shelf);
    rig.world.updateWorldMatrix(true, true);
    const before = worldPositionsOf(copies);
    const bake = new CommandEntityArrayBake([shelf]);
    expect(bake.hasChanges()).toBe(true);
    rig.stack.push(bake);
    rig.world.updateWorldMatrix(true, true);
    expect(EntityArrayStore.read(shelf)).toBeNull();
    for (const copy of copies) {
      expect(copy.parent).toBe(rig.world);
      expect(EntityArrayCopyMark.is(copy)).toBe(false);
      expect(
        copy.getWorldPosition(new THREE.Vector3()).distanceTo(before.get(copy.uuid) ?? new THREE.Vector3()),
      ).toBeCloseTo(0, 9);
      entityArrayTestPickMeshesOf(copy).forEach((marker) => expect(entityPickMeshSelectableIs(marker)).toBe(true));
    }
    rig.stack.undo();
    expect(EntityArrayCopyMark.copiesOf(shelf).map((copy) => copy.uuid)).toEqual(copies.map((copy) => copy.uuid));
    expect(EntityArrayStore.read(shelf)).not.toBeNull();
  });

  it('changes nothing for entities that do not repeat', () => {
    const rig = entityArrayTestRigCreate(cleanups);
    const shelf = entityArrayTestShelfPlace(rig, new THREE.Vector3());
    expect(new CommandEntityArrayBake([shelf]).hasChanges()).toBe(false);
  });
});
