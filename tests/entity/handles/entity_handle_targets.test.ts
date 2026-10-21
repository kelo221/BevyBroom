import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { entityHandleTargetsKey, entityHandleTargetsOf } from '@/entity/handles/entity_handle_targets.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { RoomOwner } from '@/portal/model/room_owner.js';
import { setObjectLocked } from '@/utils/object_lock.js';

/**
 * Returns the marker of an entity owner or fails the test.
 *
 * @param owner Entity owner.
 * @returns Marker mesh.
 */
function markerRead(owner: THREE.Object3D): THREE.Mesh {
  const marker = LightOwner.markerOf(owner);
  if (!marker) {
    throw new Error('entity has no marker');
  }
  return marker;
}

describe('entity handle targets', () => {
  it('gives a point light a radius ball and a spot light a radius and a cone ball', () => {
    const point = LightOwner.createDefault('Point', 'point');
    const spot = LightOwner.createDefault('Spot', 'spot');
    const names = (owner: THREE.Object3D): string[] =>
      entityHandleTargetsOf([markerRead(owner)]).map((target) => target.handle.handleName);
    expect(names(point)).toEqual(['radius']);
    expect(names(spot)).toEqual(['radius', 'cone-angle']);
  });

  it('lists each owner once even when its marker and the owner are both given', () => {
    const point = LightOwner.createDefault('Point', 'point');
    expect(entityHandleTargetsOf([markerRead(point), point])).toHaveLength(1);
  });

  it('gives locked lights, rooms, game entities and plain meshes no handles', () => {
    const locked = LightOwner.createDefault('Locked', 'spot');
    setObjectLocked(locked, true);
    const selection = [
      markerRead(locked),
      markerRead(RoomOwner.createDefault('Room')),
      markerRead(GameEntityOwner.createDefault('Thing')),
      new THREE.Mesh(new THREE.BoxGeometry()),
    ];
    expect(entityHandleTargetsOf(selection)).toEqual([]);
  });

  it('names the same handles with the same key', () => {
    const spot = LightOwner.createDefault('Spot', 'spot');
    const first = entityHandleTargetsKey(entityHandleTargetsOf([spot]));
    expect(entityHandleTargetsKey(entityHandleTargetsOf([markerRead(spot)]))).toBe(first);
    expect(entityHandleTargetsKey(entityHandleTargetsOf([LightOwner.createDefault('Other', 'spot')]))).not.toBe(first);
  });
});
