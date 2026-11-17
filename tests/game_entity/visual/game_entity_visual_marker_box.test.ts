import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ENTITY_POINT_BOX_SIZE } from '@/entity/visual/entity_visual_point_box_geometry.js';
import type { GameEntityClass, GameEntityMarkerBox } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityOwner, gameEntityCreateForClass } from '@/game_entity/owner/game_entity_owner.js';
import { GameEntityVisualBuilder } from '@/game_entity/visual/game_entity_visual_builder.js';
import { GameEntityVisualMarkerBox } from '@/game_entity/visual/game_entity_visual_marker_box.js';
import {
  testClassesInstall,
  testClassListCreate,
  testDoorClassCreate,
  testSpinnerClassCreate,
} from '../game_entity_test_classes.js';

/** Marker box of doors whose kind has no box of its own. */
const DOOR_BOX_PLAIN: GameEntityMarkerBox = { size: [1, 2, 0.2], offset: [0, 1, 0] };

/** Marker box of iron doors: wider, and starting at the entity origin along x. */
const DOOR_BOX_IRON: GameEntityMarkerBox = { size: [3, 2.5, 0.4], offset: [1.5, 1.25, 0] };

/**
 * Returns the test door class declaring a plain marker box and an iron one
 * picked by its kind field.
 *
 * @returns Door class with marker boxes.
 */
function doorClassWithBoxes(): GameEntityClass {
  return {
    ...testDoorClassCreate(),
    marker_box: DOOR_BOX_PLAIN,
    marker_box_field: 'kind',
    marker_boxes: { Iron: DOOR_BOX_IRON },
  };
}

/**
 * Installs the test classes with the door replaced by one that declares marker
 * boxes.
 *
 * @returns Uninstall callback.
 */
function doorClassWithBoxesInstall(): () => void {
  const list = testClassListCreate();
  list.classes = [doorClassWithBoxes(), testSpinnerClassCreate()];
  return testClassesInstall(list).uninstall;
}

/**
 * Returns the box the marker of an owner fills in the owner's own space, after
 * the marker had its chance to follow class and component changes.
 *
 * @param owner Game entity owner.
 * @returns Bounds of the marker geometry.
 */
function markerBoundsRead(owner: THREE.Object3D): THREE.Box3 {
  GameEntityVisualBuilder.refresh(owner);
  const geometry = GameEntityOwner.markerOf(owner)?.geometry;
  if (geometry === undefined) {
    throw new Error('the game entity has a marker');
  }
  geometry.computeBoundingBox();
  return geometry.boundingBox?.clone() ?? new THREE.Box3();
}

/**
 * Returns the box a marker box declaration describes.
 *
 * @param markerBox Marker box declaration.
 * @returns Expected bounds.
 */
function boundsOfMarkerBox(markerBox: GameEntityMarkerBox): THREE.Box3 {
  return new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(...markerBox.offset),
    new THREE.Vector3(...markerBox.size),
  );
}

/**
 * Expects two boxes to match within floating point rounding.
 *
 * @param actual Measured box.
 * @param expected Expected box.
 */
function expectBoxesMatch(actual: THREE.Box3, expected: THREE.Box3): void {
  expect(actual.min.distanceTo(expected.min)).toBeLessThan(1e-6);
  expect(actual.max.distanceTo(expected.max)).toBeLessThan(1e-6);
}

/**
 * Game classes may declare the box their entities' markers are drawn as,
 * directly or picked by the value of one field, so an entity shows the space
 * the game gives it instead of a small point box.
 */
describe('GameEntityVisualMarkerBox', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('gives no box to entities whose classes declare none', () => {
    cleanups.push(testClassesInstall().uninstall);
    const owner = gameEntityCreateForClass(testDoorClassCreate());
    expect(GameEntityVisualMarkerBox.boxOf(owner)).toBeNull();
    const pointBounds = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(),
      new THREE.Vector3().setScalar(ENTITY_POINT_BOX_SIZE),
    );
    expectBoxesMatch(markerBoundsRead(owner), pointBounds);
  });

  it('uses the class box when the field value has no box of its own', () => {
    cleanups.push(doorClassWithBoxesInstall());
    const owner = gameEntityCreateForClass(doorClassWithBoxes());
    expect(GameEntityVisualMarkerBox.boxOf(owner)).toEqual(DOOR_BOX_PLAIN);
    expectBoxesMatch(markerBoundsRead(owner), boundsOfMarkerBox(DOOR_BOX_PLAIN));
  });

  it('picks the box of an overridden field value and follows the field back to its default', () => {
    cleanups.push(doorClassWithBoxesInstall());
    const door = doorClassWithBoxes();
    const owner = gameEntityCreateForClass(door);
    GameEntityComponentStore.write(owner, { [door.type_path]: { kind: 'Iron' } });
    expectBoxesMatch(markerBoundsRead(owner), boundsOfMarkerBox(DOOR_BOX_IRON));
    GameEntityComponentStore.write(owner, { [door.type_path]: {} });
    expectBoxesMatch(markerBoundsRead(owner), boundsOfMarkerBox(DOOR_BOX_PLAIN));
  });

  it('picks the box of the field default', () => {
    const door: GameEntityClass = { ...doorClassWithBoxes(), marker_boxes: { Wooden: DOOR_BOX_IRON } };
    const list = testClassListCreate();
    list.classes = [door];
    cleanups.push(testClassesInstall(list).uninstall);
    const owner = gameEntityCreateForClass(door);
    expect(GameEntityVisualMarkerBox.boxOf(owner)).toEqual(DOOR_BOX_IRON);
  });

  it('keeps the edge lines on the same box as the faces', () => {
    cleanups.push(doorClassWithBoxesInstall());
    const owner = gameEntityCreateForClass(doorClassWithBoxes());
    const faceBounds = markerBoundsRead(owner);
    const edges = GameEntityOwner.markerOf(owner)?.children.find((child) => child instanceof THREE.LineSegments);
    if (!(edges instanceof THREE.LineSegments)) {
      throw new Error('the marker has edge lines');
    }
    edges.geometry.computeBoundingBox();
    expectBoxesMatch(edges.geometry.boundingBox ?? new THREE.Box3(), faceBounds);
  });
});
