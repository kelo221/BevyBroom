import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { GameEntityClassProviderProject } from '@/game_entity/class/game_entity_class_provider_project.js';
import { gameEntityClassListEmpty } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import type { ObjectEntry } from '@/io/scene/io_types.js';
import { COLLISION_KIND_DEFAULT, CollisionKindStore } from '@/level_export/kind/collision_kind_store.js';
import { CommandCollisionKindSet } from '@/level_export/kind/command_collision_kind_set.js';
import { ObjectDataContributorCollisionKind } from '@/level_export/kind/object_data_contributor_collision_kind.js';

const ZONE_CLASS = 'kind_test::FinishZone';

/** Makes a class known that declares the volume kind. */
function zoneClassDeclare(): void {
  GameEntityClassProviderProject.shared.listWrite({
    ...gameEntityClassListEmpty(),
    classes: [
      {
        type_path: ZONE_CLASS,
        label: 'Zone',
        category: 'Game',
        placement: 'any',
        marker_color: [1, 0, 0],
        collision: 'volume',
        fields: [],
      },
    ],
  });
}

afterEach(() => {
  GameEntityClassProviderProject.shared.listWrite(gameEntityClassListEmpty());
});

/** Objects take their own kind, else their class kind, else solid. */
describe('CollisionKindStore', () => {
  it('resolves to solid, then to the declared class kind, then to the override', () => {
    const object = new THREE.Group();
    expect(CollisionKindStore.resolve(object)).toBe(COLLISION_KIND_DEFAULT);
    zoneClassDeclare();
    GameEntityComponentStore.write(object, { [ZONE_CLASS]: {} });
    expect(CollisionKindStore.resolve(object)).toBe('volume');
    CollisionKindStore.overrideWrite(object, 'none');
    expect(CollisionKindStore.resolve(object)).toBe('none');
    CollisionKindStore.overrideWrite(object, null);
    expect(CollisionKindStore.overrideRead(object)).toBeNull();
  });

  it('reads only known kinds', () => {
    expect(CollisionKindStore.fromUnknown('volume')).toBe('volume');
    expect(CollisionKindStore.fromUnknown('lava')).toBeNull();
    expect(CollisionKindStore.fromUnknown(3)).toBeNull();
  });

  it('sets the override of several objects as one undo step', () => {
    const objects = [new THREE.Group(), new THREE.Group()];
    CollisionKindStore.overrideWrite(objects[1] ?? new THREE.Group(), 'none');
    const stack = new CommandStack(8);
    const command = new CommandCollisionKindSet(objects, 'volume');
    expect(command.hasChanges()).toBe(true);
    stack.push(command);
    expect(objects.map((object) => CollisionKindStore.overrideRead(object))).toEqual(['volume', 'volume']);
    stack.undo();
    expect(objects.map((object) => CollisionKindStore.overrideRead(object))).toEqual([null, 'none']);
    expect(new CommandCollisionKindSet(objects.slice(0, 1), null).hasChanges()).toBe(false);
  });

  it('keeps the override through scene entries and duplicates', () => {
    const contributor = new ObjectDataContributorCollisionKind();
    const source = new THREE.Group();
    CollisionKindStore.overrideWrite(source, 'volume');
    const entry = {} as ObjectEntry;
    contributor.sceneEntryWrite(source, entry);
    const loaded = new THREE.Group();
    contributor.sceneEntryRead(entry, loaded);
    const copy = new THREE.Group();
    contributor.duplicateDataCopy(source, copy);
    expect([CollisionKindStore.overrideRead(loaded), CollisionKindStore.overrideRead(copy)]).toEqual([
      'volume',
      'volume',
    ]);
    const plainEntry = {} as ObjectEntry;
    contributor.sceneEntryWrite(new THREE.Group(), plainEntry);
    expect(plainEntry.collisionKind).toBeUndefined();
  });
});
