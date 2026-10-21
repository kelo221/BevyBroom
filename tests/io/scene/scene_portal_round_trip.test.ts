import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import { PortalOwner } from '@/portal/model/portal_owner.js';
import { portalSettingsCreateDefault } from '@/portal/model/portal_settings.js';
import { RoomOwner } from '@/portal/model/room_owner.js';
import { roomSettingsCreateDefault } from '@/portal/model/room_settings.js';

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

/**
 * Scene files keep rooms and portals with their ids, parents, transforms and
 * settings.
 */
describe('scene room and portal round trip', () => {
  it('restores a parented room and a closed portal', () => {
    const world = new THREE.Group();
    const parent = new THREE.Group();
    parent.position.set(-2, 0, 6);
    const room = RoomOwner.create('Hall', { ...roomSettingsCreateDefault(), halfSizeX: 4.5 });
    room.position.set(0, 1.5, 0);
    room.scale.set(1, 2, 1);
    const portal = PortalOwner.create('Door', { ...portalSettingsCreateDefault(), width: 1.8, closed: true });
    portal.position.set(4.5, 1.1, 0);
    portal.rotation.set(0, Math.PI / 2, 0);
    parent.add(room, portal);
    world.add(parent);
    const loaded = roundTrip(world);
    for (const [owner, entityOwner] of [
      [room, RoomOwner],
      [portal, PortalOwner],
    ] as const) {
      const restored = loaded.getObjectByProperty('uuid', owner.uuid);
      expect(restored?.parent?.uuid).toBe(parent.uuid);
      if (!restored) continue;
      expect(restored.position.distanceTo(owner.position)).toBeLessThan(1e-6);
      expect(restored.quaternion.angleTo(owner.quaternion)).toBeLessThan(1e-6);
      expect(restored.scale.distanceTo(owner.scale)).toBeLessThan(1e-6);
      expect(entityOwner.settingsRead(restored)).toEqual(entityOwner.settingsRead(owner));
    }
  });

  it('writes one entry per room or portal with the settings under its kind', () => {
    const world = new THREE.Group();
    world.add(RoomOwner.createDefault('Hall'), PortalOwner.createDefault('Door'));
    const data = new SceneSerializer().serialize(world);
    expect(data.objects.map((entry) => entry.type)).toEqual(['room', 'portal']);
    expect(data.objects[0]?.room).toEqual(roomSettingsCreateDefault());
    expect(data.objects[1]?.portal).toEqual(portalSettingsCreateDefault());
  });
});
