import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { entityKindRead, entityOwnerOfPart, entityPickMeshIs } from '@/entity/model/entity_owner_keys.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { PortalOwner } from '@/portal/model/portal_owner.js';
import { portalSettingsCreateDefault } from '@/portal/model/portal_settings.js';
import { RoomOwner } from '@/portal/model/room_owner.js';
import { roomSettingsCreateDefault } from '@/portal/model/room_settings.js';
import { isEditorHelperObject } from '@/utils/mesh_edge_sync.js';

/**
 * Returns the local bounds of an owner's guide lines with the given name.
 *
 * @param owner Entity owner.
 * @param partName Guide object name.
 * @returns Bounds of the guide geometry in owner space.
 */
function guideBounds(owner: THREE.Object3D, partName: string): THREE.Box3 {
  const part = owner.children.find((child) => child.name === partName);
  expect(part).toBeInstanceOf(THREE.LineSegments);
  const bounds = new THREE.Box3();
  if (part instanceof THREE.LineSegments) {
    part.geometry.computeBoundingBox();
    bounds.copy(part.geometry.boundingBox ?? bounds);
  }
  return bounds;
}

/**
 * Rooms and portals are entity owners whose editor-only visuals follow their
 * settings, and each kind only reads its own owners.
 */
describe('room and portal owners', () => {
  it('creates kind-flagged owners with pick markers that resolve back to them', () => {
    const room = RoomOwner.createDefault('Hall');
    const portal = PortalOwner.createDefault('Door');
    expect(entityKindRead(room)).toBe('room');
    expect(entityKindRead(portal)).toBe('portal');
    for (const owner of [room, portal]) {
      const marker = RoomOwner.markerOf(owner);
      expect(marker).not.toBeNull();
      if (!marker) continue;
      expect(entityPickMeshIs(marker)).toBe(true);
      expect(entityOwnerOfPart(marker)).toBe(owner);
      expect(isEditorHelperObject(marker)).toBe(true);
    }
  });

  it('draws the room box at its half sizes and redraws it when they change', () => {
    const settings = { ...roomSettingsCreateDefault(), halfSizeX: 3, halfSizeY: 1.25, halfSizeZ: 5 };
    const room = RoomOwner.create('Hall', settings);
    const bounds = guideBounds(room, 'Room Bounds');
    expect(bounds.max.toArray()).toEqual([3, 1.25, 5]);
    expect(bounds.min.toArray()).toEqual([-3, -1.25, -5]);
    RoomOwner.settingsWrite(room, { ...settings, halfSizeX: 7 });
    expect(guideBounds(room, 'Room Bounds').max.x).toBe(7);
    expect(room.children.filter((child) => child.name === 'Room Bounds')).toHaveLength(1);
  });

  it('sizes the portal surface and outline, points the arrow along +Z and dashes closed portals', () => {
    const settings = { ...portalSettingsCreateDefault(), width: 2.5, height: 3 };
    const portal = PortalOwner.create('Door', settings);
    const outline = guideBounds(portal, 'Portal Outline');
    expect(outline.max.x - outline.min.x).toBeCloseTo(2.5);
    expect(outline.max.y - outline.min.y).toBeCloseTo(3);
    expect(guideBounds(portal, 'Portal Front').max.z).toBeGreaterThan(0);
    expect(PortalOwner.markerOf(portal)?.scale.toArray()).toEqual([2.5, 3, 1]);
    PortalOwner.settingsWrite(portal, { ...settings, closed: true });
    const closedOutline = portal.children.find((child) => child.name === 'Portal Outline');
    expect(closedOutline instanceof THREE.LineSegments && closedOutline.material).toBeInstanceOf(
      THREE.LineDashedMaterial,
    );
  });

  it('reads settings only from owners of its own kind', () => {
    const room = RoomOwner.createDefault('Hall');
    const light = LightOwner.createDefault('Lamp', 'point');
    expect(PortalOwner.settingsRead(room)).toBeNull();
    expect(RoomOwner.settingsRead(light)).toBeNull();
    expect(RoomOwner.settingsRead(room)).toEqual(roomSettingsCreateDefault());
  });
});
