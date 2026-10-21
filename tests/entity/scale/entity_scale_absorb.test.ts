import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  entityScaleAbsorbedSettingsRead,
  entityScaleAbsorbsAll,
  entityScaleFactorUniform,
  entityScaleSettingsShown,
  entityScaleUnitEnsure,
} from '@/entity/scale/entity_scale_absorb.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { RoomOwner } from '@/portal/model/room_owner.js';

/**
 * Covers the helpers that turn the scale of kinds such as lights into their
 * settings: the uniform factor of a scale, which objects absorb scale, and the
 * settings an owner shows while it is scaled.
 */
describe('entity scale absorb helpers', () => {
  it('reads a uniform scale as its factor and a single-axis scale as that axis', () => {
    expect(entityScaleFactorUniform(new THREE.Vector3(2, 2, 2))).toBeCloseTo(2);
    expect(entityScaleFactorUniform(new THREE.Vector3(1, 0.5, 1))).toBeCloseTo(0.5);
    expect(entityScaleFactorUniform(new THREE.Vector3(1.5, 1, 3))).toBeCloseTo(3);
    expect(entityScaleFactorUniform(new THREE.Vector3(1, 1, 1))).toBe(1);
  });

  it('counts a mirrored component by its size', () => {
    expect(entityScaleFactorUniform(new THREE.Vector3(-2, 1, 1))).toBeCloseTo(2);
  });

  it('treats lights as absorbing scale and rooms and plain objects as keeping it', () => {
    const light = LightOwner.createDefault('Light', 'point');
    const room = RoomOwner.createDefault('Room');
    expect(entityScaleAbsorbsAll([light])).toBe(true);
    expect(entityScaleAbsorbsAll([light, room])).toBe(false);
    expect(entityScaleAbsorbsAll([new THREE.Mesh()])).toBe(false);
    expect(entityScaleAbsorbsAll([])).toBe(false);
  });

  it('shows the radius a scaled light stands for without changing its stored settings', () => {
    const light = LightOwner.createDefault('Light', 'spot');
    const storedRadius = LightOwner.settingsRead(light)?.radius ?? 0;
    light.scale.set(1, 1, 2.5);
    expect(entityScaleSettingsShown(LightOwner, light)?.radius).toBeCloseTo(storedRadius * 2.5);
    expect(LightOwner.settingsRead(light)?.radius).toBe(storedRadius);
  });

  it('shows the stored settings of a light at unit scale and of kinds that keep scale', () => {
    const light = LightOwner.createDefault('Light', 'point');
    const room = RoomOwner.createDefault('Room');
    room.scale.set(2, 2, 2);
    expect(entityScaleSettingsShown(LightOwner, light)).toEqual(LightOwner.settingsRead(light));
    expect(entityScaleSettingsShown(RoomOwner, room)).toEqual(RoomOwner.settingsRead(room));
    expect(entityScaleAbsorbedSettingsRead(room)).toBeNull();
  });

  it('resets the scale of absorbing owners only', () => {
    const light = LightOwner.createDefault('Light', 'point');
    const mesh = new THREE.Mesh();
    light.scale.set(3, 3, 3);
    mesh.scale.set(3, 3, 3);
    entityScaleUnitEnsure(light);
    entityScaleUnitEnsure(mesh);
    expect(light.scale.toArray()).toEqual([1, 1, 1]);
    expect(mesh.scale.toArray()).toEqual([3, 3, 3]);
  });
});
