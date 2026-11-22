import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { entityPickDisabledSet, ENTITY_PICK_DISABLED_USERDATA_KEY } from '@/entity/model/entity_owner_keys.js';
import { EntityArrayCopyMark } from '@/entity_array/model/entity_array_copy_mark.js';
import { EntityArraySettingsRules } from '@/entity_array/model/entity_array_settings.js';
import { EntityArrayStore } from '@/entity_array/model/entity_array_store.js';
import { ObjectDataContributorEntityArray } from '@/entity_array/persistence/object_data_contributor_entity_array.js';
import type { ObjectEntry } from '@/io/scene/io_types.js';

/**
 * Returns an empty scene entry.
 *
 * @returns Entry without feature data.
 */
function entryCreate(): ObjectEntry {
  return {
    uuid: 'entry',
    name: 'entry',
    type: 'group',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    visible: true,
    parentId: null,
  };
}

/** Array settings and copy marks survive scene files and duplication. */
describe('ObjectDataContributorEntityArray', () => {
  const contributor = new ObjectDataContributorEntityArray();

  it('writes and reads array settings through a scene entry', () => {
    const settings = EntityArraySettingsRules.fromUnknown({ count_x: 4, count_z: 2, gap: [0.5, 0, 1] });
    const source = new THREE.Group();
    EntityArrayStore.write(source, settings);
    const entry = entryCreate();
    contributor.sceneEntryWrite(source, entry);
    const loaded = new THREE.Group();
    contributor.sceneEntryRead(JSON.parse(JSON.stringify(entry)) as ObjectEntry, loaded);
    expect(EntityArrayStore.read(loaded)).toEqual(settings);
    expect(EntityArrayCopyMark.is(loaded)).toBe(false);
  });

  it('restores a copy mark and keeps the loaded copy from being clicked', () => {
    const copy = new THREE.Group();
    EntityArrayCopyMark.write(copy, { cell: [2, 0, 1], signature: 'abc' });
    const entry = entryCreate();
    contributor.sceneEntryWrite(copy, entry);
    const loaded = new THREE.Group();
    contributor.sceneEntryRead(JSON.parse(JSON.stringify(entry)) as ObjectEntry, loaded);
    expect(EntityArrayCopyMark.read(loaded)).toEqual({ cell: [2, 0, 1], signature: 'abc' });
    expect(loaded.userData[ENTITY_PICK_DISABLED_USERDATA_KEY]).toBe(true);
    EntityArrayCopyMark.clear(loaded);
    expect(loaded.userData[ENTITY_PICK_DISABLED_USERDATA_KEY]).toBeUndefined();
  });

  it('writes nothing for ordinary objects', () => {
    const entry = entryCreate();
    const plain = new THREE.Group();
    entityPickDisabledSet(plain, false);
    contributor.sceneEntryWrite(plain, entry);
    expect(entry.entityArray).toBeUndefined();
    expect(entry.entityArrayCopy).toBeUndefined();
  });

  it('gives a duplicate the settings and mark of its source', () => {
    const source = new THREE.Group();
    EntityArrayStore.write(source, EntityArraySettingsRules.createDefault());
    EntityArrayCopyMark.write(source, { cell: [1, 0, 0], signature: 'sig' });
    const duplicate = new THREE.Group();
    contributor.duplicateDataCopy(source, duplicate);
    expect(EntityArrayStore.read(duplicate)).toEqual(EntityArrayStore.read(source));
    expect(EntityArrayCopyMark.read(duplicate)).toEqual(EntityArrayCopyMark.read(source));
  });
});
