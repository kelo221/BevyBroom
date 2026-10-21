import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';

/**
 * Builds a world holding a group with a light inside, and a loose mesh.
 *
 * @returns World, the group, the light and the mesh.
 */
function worldCreate(): { world: THREE.Group; group: THREE.Group; light: THREE.Object3D; mesh: THREE.Mesh } {
  const world = new THREE.Group();
  const group = new THREE.Group();
  group.name = 'Room';
  group.position.set(4, 0, 0);
  const light = LightOwner.create('Lamp', lightSettingsCreateDefault('point'));
  light.position.set(0, 2, 0);
  group.add(light);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  mesh.name = 'Crate';
  world.add(group, mesh);
  return { world, group, light, mesh };
}

/** Serializing chosen roots and loading entries next to existing content. */
describe('scene serializer roots and deserializer entries', () => {
  it('writes only the given roots as parentless entries followed by their descendants', () => {
    const { group, light } = worldCreate();
    const entries = new SceneSerializer().serializeRoots([group]);
    expect(entries.map((entry) => entry.uuid)).toEqual([group.uuid, light.uuid]);
    expect(entries[0]?.parentId).toBeNull();
    expect(entries[1]?.parentId).toBe(group.uuid);
  });

  it('adds loaded entries to a parent without clearing what is already there', () => {
    const { group, light, mesh } = worldCreate();
    const entries = new SceneSerializer().serializeRoots([group]);
    const target = new THREE.Group();
    const existing = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    target.add(existing);
    const added = new SceneDeserializer().deserializeEntriesInto(entries, target);
    expect(added.map((object) => object.uuid)).toEqual([group.uuid]);
    expect(target.children).toContain(existing);
    expect(target.getObjectByProperty('uuid', light.uuid)?.parent?.uuid).toBe(group.uuid);
    expect(target.getObjectByProperty('uuid', mesh.uuid)).toBeUndefined();
  });

  it('creates parentless objects from entries without adding them anywhere', () => {
    const { group, mesh } = worldCreate();
    const entries = new SceneSerializer().serializeRoots([group, mesh]);
    const created = new SceneDeserializer().objectsCreateFromEntries(entries);
    expect(created.map((object) => object.uuid)).toEqual([group.uuid, mesh.uuid]);
    created.forEach((object) => expect(object.parent).toBeNull());
  });
});
