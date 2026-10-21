import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import { documentIdentityEnsure, documentIdentityRead } from '@/io/document/document_identity.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { isLightOwner } from '@/light/model/light_owner_keys.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';

/**
 * Saves a world and loads it into a fresh world through JSON text.
 *
 * @param world Source world.
 * @returns Loaded world.
 */
function roundTrip(world: THREE.Group): THREE.Group {
  const text = JSON.stringify(new SceneSerializer().serialize(world));
  const loaded = new THREE.Group();
  new SceneDeserializer().deserialize(JSON.parse(text), loaded);
  return loaded;
}

/** Scene files keep lights, their parents and the document identity. */
describe('scene light round trip', () => {
  it('restores a parented spot light with its id, transform and settings', () => {
    const world = new THREE.Group();
    const parent = new THREE.Group();
    parent.position.set(4, 0, 0);
    const settings = { ...lightSettingsCreateDefault('spot'), radius: 9.5, colorHex: 0x3366ff, realtime: true };
    const light = LightOwner.create('Hall Spot', settings);
    light.position.set(1, 2.5, -3);
    light.rotation.set(-0.4, 0.2, 0);
    parent.add(light);
    world.add(parent);
    const loaded = roundTrip(world);
    const restored = loaded.getObjectByProperty('uuid', light.uuid);
    expect(restored).toBeDefined();
    if (!restored) return;
    expect(isLightOwner(restored)).toBe(true);
    expect(restored.parent?.uuid).toBe(parent.uuid);
    expect(restored.position.distanceTo(light.position)).toBeLessThan(1e-6);
    expect(restored.quaternion.angleTo(light.quaternion)).toBeLessThan(1e-6);
    expect(LightOwner.settingsRead(restored)).toEqual(LightOwner.settingsRead(light));
    expect(LightOwner.markerOf(restored)).not.toBeNull();
  });

  it('loads a light saved with a scale at scale one with its radius unchanged', () => {
    const world = new THREE.Group();
    const settings = lightSettingsCreateDefault('point');
    const light = LightOwner.create('Scaled Lamp', settings);
    light.scale.set(2, 3, 4);
    world.add(light);
    const restored = roundTrip(world).getObjectByProperty('uuid', light.uuid);
    expect(restored).toBeDefined();
    if (!restored) return;
    expect(restored.scale.distanceTo(new THREE.Vector3(1, 1, 1))).toBeLessThan(1e-9);
    expect(LightOwner.settingsRead(restored)?.radius).toBe(settings.radius);
  });

  it('does not save light visuals as separate objects', () => {
    const world = new THREE.Group();
    world.add(LightOwner.createDefault('Lamp', 'spot'));
    const data = new SceneSerializer().serialize(world);
    expect(data.objects).toHaveLength(1);
    expect(data.objects[0]?.type).toBe('light');
  });

  it('keeps the document identifier across save and load and replaces it on clear', () => {
    const world = new THREE.Group();
    const identifier = documentIdentityEnsure(world);
    const loaded = roundTrip(world);
    expect(documentIdentityRead(loaded)).toBe(identifier);
    new SceneDeserializer().clearContent(loaded);
    expect(documentIdentityRead(loaded)).not.toBe(identifier);
    expect(documentIdentityRead(loaded)).not.toBeNull();
  });
});
