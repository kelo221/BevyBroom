import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { entityOwnerDescendantsCollect } from '@/entity/model/entity_owner_descendants.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { entityPickDisabledSet } from '@/entity/model/entity_owner_keys.js';

/**
 * Returns whether an object is an authored light.
 *
 * @param object Candidate object.
 * @returns True for light owners.
 */
function lightOwnerAccept(object: THREE.Object3D): boolean {
  return LightOwner.isOwner(object);
}

/**
 * Collecting owners below a selected object finds the lights inside groups and
 * inside other entities, counts a selected light itself and leaves out copies
 * that turned clicking off.
 */
describe('entity owner descendants', () => {
  it('returns a selected owner itself', () => {
    const light = LightOwner.createDefault('Lamp', 'point');
    expect(entityOwnerDescendantsCollect(light, lightOwnerAccept)).toEqual([light]);
  });

  it('finds owners nested in plain groups in scene order', () => {
    const fixture = new THREE.Group();
    const firstLight = LightOwner.createDefault('Lamp', 'point');
    const innerGroup = new THREE.Group();
    const secondLight = LightOwner.createDefault('Lamp', 'spot');
    fixture.add(new THREE.Mesh(), firstLight, innerGroup);
    innerGroup.add(secondLight);
    expect(entityOwnerDescendantsCollect(fixture, lightOwnerAccept)).toEqual([firstLight, secondLight]);
  });

  it('returns nothing for groups without owners of the accepted kind', () => {
    const fixture = new THREE.Group();
    fixture.add(new THREE.Mesh(), new THREE.Group());
    expect(entityOwnerDescendantsCollect(fixture, lightOwnerAccept)).toEqual([]);
  });

  it('finds owners nested inside an entity the test rejects', () => {
    const fixtureEntity = LightOwner.createDefault('Fixture', 'point');
    const childLight = LightOwner.createDefault('ChildLight', 'point');
    fixtureEntity.add(childLight);
    const acceptChildOnly = (object: THREE.Object3D): boolean => object === childLight;
    expect(entityOwnerDescendantsCollect(fixtureEntity, acceptChildOnly)).toEqual([childLight]);
  });

  it('leaves out objects below the root that turned clicking off', () => {
    const source = new THREE.Group();
    const sourceLight = LightOwner.createDefault('Lamp', 'point');
    const copy = new THREE.Group();
    copy.add(LightOwner.createDefault('Lamp', 'point'));
    entityPickDisabledSet(copy, true);
    source.add(sourceLight, copy);
    expect(entityOwnerDescendantsCollect(source, lightOwnerAccept)).toEqual([sourceLight]);
  });

  it('counts a selected root that turned clicking off', () => {
    const copyLight = LightOwner.createDefault('Lamp', 'point');
    entityPickDisabledSet(copyLight, true);
    expect(entityOwnerDescendantsCollect(copyLight, lightOwnerAccept)).toEqual([copyLight]);
  });
});
