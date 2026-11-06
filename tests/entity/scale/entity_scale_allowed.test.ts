import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EntityClassPointGame } from '@/entity/class/classes/entity_class_point_game.js';
import { EntityClassObjectStateStore } from '@/entity/class/entity_class_object_state.js';
import {
  entityScaleKeptFor,
  entityTransformScaleAllowed,
  entityTransformScaleAllowedAll,
} from '@/entity/scale/entity_scale_allowed.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { PortalOwner } from '@/portal/model/portal_owner.js';
import { RoomOwner } from '@/portal/model/room_owner.js';
import { testClassesInstall, testDoorClassCreate } from '../../game_entity/game_entity_test_classes.js';

/**
 * Returns an entity marker, failing the test when the entity has none.
 *
 * @param marker Marker mesh, or null.
 * @returns The marker mesh.
 */
function markerRequire(marker: THREE.Mesh | null): THREE.Mesh {
  if (!marker) {
    throw new Error('entity has no marker mesh');
  }
  return marker;
}

/**
 * Proves the per-kind scale capability: lights and point game entities only
 * move and rotate, whether their owner or their clicked marker is selected,
 * rooms, portals and ordinary meshes may be scaled, one point in a selection
 * makes the whole selection unscalable, and objects turning into such points
 * get a unit scale.
 */
describe('entity_scale_allowed', () => {
  let uninstall: () => void = () => {};

  beforeEach(() => {
    uninstall = testClassesInstall().uninstall;
  });

  afterEach(() => {
    uninstall();
  });

  it('turns scaling off on the light and game entity definitions only', () => {
    expect(LightOwner.definition.transformScaleAllowed()).toBe(false);
    expect(GameEntityOwner.definition.transformScaleAllowed()).toBe(false);
    expect(RoomOwner.definition.transformScaleAllowed()).toBe(true);
    expect(PortalOwner.definition.transformScaleAllowed()).toBe(true);
  });

  it('forbids scaling lights and game entities through their owners and their markers', () => {
    const lights = [LightOwner.createDefault('Lamp', 'point'), LightOwner.createDefault('Spot', 'spot')];
    const gameEntity = GameEntityOwner.createDefault('door_main');
    const points = [...lights, gameEntity];
    const markers = [
      ...lights.map((light) => markerRequire(LightOwner.markerOf(light))),
      markerRequire(GameEntityOwner.markerOf(gameEntity)),
    ];
    expect([...points, ...markers].map((object) => entityTransformScaleAllowed(object))).toEqual(
      new Array(points.length * 2).fill(false),
    );
  });

  it('allows scaling rooms, portals and ordinary meshes', () => {
    const room = RoomOwner.createDefault('Hall');
    const portal = PortalOwner.createDefault('Door');
    const scalable = [room, markerRequire(RoomOwner.markerOf(room)), portal, new THREE.Mesh(), new THREE.Group()];
    expect(scalable.every((object) => entityTransformScaleAllowed(object))).toBe(true);
  });

  it('forbids scaling a selection as soon as one object may not be scaled', () => {
    const brush = new THREE.Mesh(new THREE.BoxGeometry());
    const gameEntityMarker = markerRequire(GameEntityOwner.markerOf(GameEntityOwner.createDefault('door_main')));
    expect(entityTransformScaleAllowedAll([brush, gameEntityMarker])).toBe(false);
    expect(entityTransformScaleAllowedAll([brush, RoomOwner.createDefault('Hall')])).toBe(true);
    expect(entityTransformScaleAllowedAll([])).toBe(true);
  });

  it('keeps a unit scale for kinds that may not be scaled and the scale for others', () => {
    const scale: readonly [number, number, number] = [2, 3, 4];
    expect(entityScaleKeptFor(GameEntityOwner.definition, scale)).toEqual([1, 1, 1]);
    expect(entityScaleKeptFor(LightOwner.definition, scale)).toEqual([1, 1, 1]);
    expect(entityScaleKeptFor(RoomOwner.definition, scale)).toEqual(scale);
  });

  it('gives a scaled brush that becomes a point game entity a unit scale', () => {
    const brush = new THREE.Mesh(new THREE.BoxGeometry());
    brush.scale.set(2, 3, 4);
    const state = EntityClassObjectStateStore.capture(brush);
    const entered = new EntityClassPointGame(testDoorClassCreate()).stateEnter(state);
    expect(entered.scale).toEqual([1, 1, 1]);
    expect(entered.entityKind).toBe(GameEntityOwner.kind);
  });
});
