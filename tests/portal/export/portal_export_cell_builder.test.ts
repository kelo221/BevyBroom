import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import { buildExportScene, EXPORT_OBJECT_IDENTITY_EXTRAS_KEY } from '@/io/scene/builder_export_scene.js';
import {
  PORTAL_EXPORT_PORTAL_CLOSED_EXTRAS_KEY,
  PORTAL_EXPORT_PORTAL_EXTRAS_KEY,
  PORTAL_EXPORT_ROOM_EXTRAS_KEY,
} from '@/portal/export/portal_export_cell_builder.js';
import { PortalOwner } from '@/portal/model/portal_owner.js';
import { portalSettingsCreateDefault } from '@/portal/model/portal_settings.js';
import { RoomOwner } from '@/portal/model/room_owner.js';
import { glbJsonRead } from '../../io/glb/glb_json_read.js';

/**
 * Creates a world with one room and one closed portal.
 *
 * @returns World, room and portal.
 */
function worldCreate(): { world: THREE.Group; room: THREE.Group; portal: THREE.Group } {
  const world = new THREE.Group();
  const room = RoomOwner.create('Hall', { halfSizeX: 3, halfSizeY: 1.5, halfSizeZ: 2 });
  room.position.set(1, 1.5, -2);
  const portal = PortalOwner.create('Door', {
    ...portalSettingsCreateDefault(),
    width: 1.2,
    height: 2.4,
    closed: true,
  });
  world.add(room, portal);
  return { world, room, portal };
}

/**
 * Exports describe rooms and portals with DynLight node extras only when asked,
 * and never contain their editor visuals.
 */
describe('room and portal export nodes', () => {
  it('leaves rooms and portals out unless the export asks for them', () => {
    const { world } = worldCreate();
    expect(buildExportScene(world).children).toHaveLength(0);
  });

  it('writes a unit-cell node scaled to the room and a closed portal square', () => {
    const { world, room, portal } = worldCreate();
    const exported = buildExportScene(world, { includeRoomAndPortalNodes: true });
    const roomGroup = exported.children.find(
      (child) => child.userData[EXPORT_OBJECT_IDENTITY_EXTRAS_KEY] === room.uuid,
    );
    const portalGroup = exported.children.find(
      (child) => child.userData[EXPORT_OBJECT_IDENTITY_EXTRAS_KEY] === portal.uuid,
    );
    const roomCell = roomGroup?.children[0];
    const portalCell = portalGroup?.children[0];
    expect(roomGroup?.position.toArray()).toEqual(room.position.toArray());
    expect(roomCell?.userData[PORTAL_EXPORT_ROOM_EXTRAS_KEY]).toBe(true);
    expect(roomCell?.scale.toArray()).toEqual([3, 1.5, 2]);
    expect(portalCell?.userData[PORTAL_EXPORT_PORTAL_EXTRAS_KEY]).toBe(true);
    expect(portalCell?.userData[PORTAL_EXPORT_PORTAL_CLOSED_EXTRAS_KEY]).toBe(true);
    expect(portalCell?.scale.toArray()).toEqual([0.6, 1.2, 1]);
    expect(roomGroup?.children).toHaveLength(1);
  });

  it('carries the extras into the GLB nodes', async () => {
    const { world } = worldCreate();
    const json = glbJsonRead(await new GlbExporter().export(world, null, { includeRoomAndPortalNodes: true }));
    const extras = (json.nodes ?? []).map((node) => node.extras ?? {});
    expect(extras.some((entry) => entry[PORTAL_EXPORT_ROOM_EXTRAS_KEY] === true)).toBe(true);
    expect(extras.some((entry) => entry[PORTAL_EXPORT_PORTAL_CLOSED_EXTRAS_KEY] === true)).toBe(true);
    expect((json.meshes ?? []).length).toBe(0);
  });
});
