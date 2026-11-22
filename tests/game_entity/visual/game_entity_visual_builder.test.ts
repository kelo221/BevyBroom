import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityOwner, gameEntityCreateForClass } from '@/game_entity/owner/game_entity_owner.js';
import { GameEntityVisualBuilder } from '@/game_entity/visual/game_entity_visual_builder.js';
import { testClassesInstall, testClassListCreate, testDoorClassCreate } from '../game_entity_test_classes.js';

/** Box the test fixture's chosen variant fills. */
const FIXTURE_BOX: { size: [number, number, number]; offset: [number, number, number] } = {
  size: [2, 0.25, 0.5],
  offset: [0, 0.125, 0],
};

/**
 * Returns the test door class whose marker box is picked by its kind field.
 *
 * @returns Class with a box per kind.
 */
function fixtureClassCreate(): GameEntityClass {
  return {
    ...testDoorClassCreate(),
    marker_box_field: 'kind',
    marker_boxes: { Iron: { size: [...FIXTURE_BOX.size], offset: [...FIXTURE_BOX.offset] } },
  };
}

/**
 * Returns the size of an entity's marker geometry.
 *
 * @param owner Game entity owner.
 * @returns Edge lengths of the marker box.
 */
function markerSizeOf(owner: THREE.Object3D): number[] {
  const marker = GameEntityOwner.markerOf(owner);
  marker?.geometry.computeBoundingBox();
  return marker?.geometry.boundingBox?.getSize(new THREE.Vector3()).toArray() ?? [];
}

/** The marker keeps the box its classes declare however often it is refreshed. */
describe('GameEntityVisualBuilder', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('keeps the declared marker box when the marker is refreshed again with unchanged data', () => {
    const fixture = fixtureClassCreate();
    const list = testClassListCreate();
    list.classes = [fixture];
    cleanups.push(testClassesInstall(list).uninstall);
    const owner = gameEntityCreateForClass(fixture, { [fixture.type_path]: { kind: 'Iron' } });
    GameEntityVisualBuilder.refresh(owner);
    expect(markerSizeOf(owner)).toEqual(FIXTURE_BOX.size);
    GameEntityVisualBuilder.refresh(owner);
    GameEntityVisualBuilder.refresh(owner);
    expect(markerSizeOf(owner)).toEqual(FIXTURE_BOX.size);
  });
});
