import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  entityBoundsLocalOf,
  entityBoundsOwnerOf,
  entityBoundsResizable,
  entityBoundsResizableAny,
} from '@/entity/bounds/entity_bounds.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { RoomOwner } from '@/portal/model/room_owner.js';
import { roomSettingsCreateDefault } from '@/portal/model/room_settings.js';
import { BuilderOrientedBounds } from '@/transform/bounds/builder_oriented_bounds.js';

/**
 * Returns the clickable marker of an entity owner or fails the test.
 *
 * @param owner Entity owner.
 * @returns The marker mesh.
 */
function markerRead(owner: THREE.Object3D): THREE.Mesh {
  const marker = LightOwner.markerOf(owner);
  if (!marker) {
    throw new Error('entity has no marker');
  }
  return marker;
}

/**
 * Creates a room whose half sizes differ on every axis.
 *
 * @returns Room owner and its half sizes.
 */
function roomCreate(): { room: THREE.Group; halfSize: THREE.Vector3 } {
  const defaults = roomSettingsCreateDefault();
  const settings = {
    halfSizeX: defaults.halfSizeX + 1,
    halfSizeY: defaults.halfSizeY,
    halfSizeZ: defaults.halfSizeZ * 2,
  };
  const room = RoomOwner.create('Room', settings);
  return { room, halfSize: new THREE.Vector3(settings.halfSizeX, settings.halfSizeY, settings.halfSizeZ) };
}

describe('entity bounds', () => {
  it('resolves the owner of a marker and of the owner itself, and nothing for plain meshes', () => {
    const light = LightOwner.createDefault('Lamp', 'point');
    expect(entityBoundsOwnerOf(markerRead(light))).toBe(light);
    expect(entityBoundsOwnerOf(light)).toBe(light);
    expect(entityBoundsOwnerOf(new THREE.Mesh(new THREE.BoxGeometry()))).toBeNull();
  });

  it('gives a room the box of its whole volume and other kinds no box', () => {
    const { room, halfSize } = roomCreate();
    const roomBox = entityBoundsLocalOf(markerRead(room));
    expect(roomBox?.max.toArray()).toEqual(halfSize.toArray());
    expect(roomBox?.min.toArray()).toEqual(halfSize.clone().negate().toArray());
    expect(entityBoundsLocalOf(markerRead(LightOwner.createDefault('Lamp', 'spot')))).toBeNull();
    expect(entityBoundsLocalOf(markerRead(GameEntityOwner.createDefault('Thing')))).toBeNull();
    expect(entityBoundsLocalOf(new THREE.Mesh(new THREE.BoxGeometry()))).toBeNull();
  });

  it('returns an independent box each time', () => {
    const { room } = roomCreate();
    const first = entityBoundsLocalOf(room);
    first?.max.set(99, 99, 99);
    expect(entityBoundsLocalOf(room)?.max.x).not.toBe(99);
  });

  it('forbids resizing lights only', () => {
    const light = markerRead(LightOwner.createDefault('Lamp', 'point'));
    const room = markerRead(roomCreate().room);
    const thing = markerRead(GameEntityOwner.createDefault('Thing'));
    const brush = new THREE.Mesh(new THREE.BoxGeometry());
    expect(entityBoundsResizable(light)).toBe(false);
    expect([room, thing, brush].map((object) => entityBoundsResizable(object))).toEqual([true, true, true]);
    expect(entityBoundsResizableAny([light])).toBe(false);
    expect(entityBoundsResizableAny([light, brush])).toBe(true);
    expect(entityBoundsResizableAny([])).toBe(false);
  });

  it('makes the selection bounds of a moved, turned and scaled room its whole volume', () => {
    const { room, halfSize } = roomCreate();
    room.position.set(3, -2, 5);
    room.rotation.set(0.3, 1.1, -0.4);
    room.scale.set(1.5, 0.5, 2);
    room.updateMatrixWorld(true);
    const bounds = new BuilderOrientedBounds().buildFromMeshes([markerRead(room)]);
    expect(bounds?.center.distanceTo(room.position)).toBeCloseTo(0, 6);
    expect(bounds?.halfExtents.distanceTo(halfSize.clone().multiply(room.scale))).toBeCloseTo(0, 6);
    expect(bounds?.quaternion.angleTo(room.quaternion)).toBeCloseTo(0, 6);
  });

  it('encloses a whole room when it is selected together with a light', () => {
    const { room, halfSize } = roomCreate();
    room.position.set(-4, 1, 2);
    room.updateMatrixWorld(true);
    const light = LightOwner.createDefault('Lamp', 'point');
    light.position.copy(room.position);
    light.updateMatrixWorld(true);
    const bounds = new BuilderOrientedBounds().buildFromMeshes([markerRead(room), markerRead(light)]);
    expect(bounds?.halfExtents.distanceTo(halfSize)).toBeCloseTo(0, 6);
    expect(bounds?.center.distanceTo(room.position)).toBeCloseTo(0, 6);
  });
});
