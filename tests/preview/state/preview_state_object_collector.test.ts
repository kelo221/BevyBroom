import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PreviewStateObjectCollector } from '@/preview/state/preview_state_object_collector.js';
import { previewLightColorChannels } from '@/preview/state/preview_state_light_converter_color.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { ModifierVolumeBevel } from '@/modifier/volume/modifier_volume_bevel.js';
import { PortalOwner } from '@/portal/model/portal_owner.js';
import { portalSettingsCreateDefault } from '@/portal/model/portal_settings.js';
import { RoomOwner } from '@/portal/model/room_owner.js';
import { PreviewGeometrySignature } from '@/preview/geometry/preview_geometry_signature.js';

/** The authored state lists the document hierarchy without editor helpers. */
describe('PreviewStateObjectCollector', () => {
  it('lists groups, meshes and lights with parent ids and local transforms', () => {
    const world = new THREE.Group();
    const hall = new THREE.Group();
    hall.position.set(5, 0, 0);
    hall.rotation.set(0, Math.PI / 2, 0);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    wall.visible = false;
    const lamp = LightOwner.create('Lamp', { ...lightSettingsCreateDefault('spot'), colorHex: 0xff8000 });
    lamp.position.set(0, 2, 0);
    hall.add(wall, lamp);
    world.add(hall);
    const objects = PreviewStateObjectCollector.collect(world);
    expect(objects.map((object) => object.kind)).toEqual(['group', 'mesh', 'light']);
    expect(objects[0]?.parent_id).toBeNull();
    expect(objects[1]?.parent_id).toBe(hall.uuid);
    expect(objects[1]?.visible).toBe(false);
    expect(objects[2]?.translation).toEqual([0, 2, 0]);
    const rotation = objects[0]?.rotation ?? [0, 0, 0, 0];
    expect(new THREE.Quaternion(...rotation).angleTo(hall.quaternion)).toBeLessThan(1e-6);
    expect(objects[2]?.light?.light_type).toBe('spot');
    expect(objects[2]?.light?.color).toEqual(previewLightColorChannels(0xff8000));
  });

  it('sends the radius a scaled light stands for while it is being scaled', () => {
    const world = new THREE.Group();
    const settings = lightSettingsCreateDefault('point');
    const lamp = LightOwner.create('Lamp', settings);
    const scaleFactor = 2.5;
    lamp.scale.setScalar(scaleFactor);
    world.add(lamp);
    const objects = PreviewStateObjectCollector.collect(world);
    expect(objects[0]?.light?.radius).toBeCloseTo(settings.radius * scaleFactor, 5);
    expect(LightOwner.settingsRead(lamp)?.radius).toBe(settings.radius);
  });

  it('leaves out light visuals and modifier volumes', () => {
    const world = new THREE.Group();
    world.add(LightOwner.createDefault('Lamp', 'point'), ModifierVolumeBevel.create());
    const objects = PreviewStateObjectCollector.collect(world);
    expect(objects).toHaveLength(1);
    expect(objects[0]?.kind).toBe('light');
  });

  it('lists rooms and portals with their sizes and closed state, without their visuals', () => {
    const world = new THREE.Group();
    const room = RoomOwner.create('Hall', { halfSizeX: 3, halfSizeY: 1.5, halfSizeZ: 2.5 });
    room.scale.set(1, 2, 1);
    const portal = PortalOwner.create('Door', {
      ...portalSettingsCreateDefault(),
      width: 1.4,
      height: 2.1,
      closed: true,
    });
    world.add(room, portal);
    const objects = PreviewStateObjectCollector.collect(world);
    expect(objects.map((object) => object.kind)).toEqual(['room', 'portal']);
    expect(objects[0]?.room?.half_size).toEqual([3, 1.5, 2.5]);
    expect(objects[0]?.scale).toEqual([1, 2, 1]);
    expect(objects[1]?.portal).toEqual({ size: [1.4, 2.1], closed: true });
  });

  it('does not change the geometry signature when a portal moves, resizes or closes', () => {
    const world = new THREE.Group();
    const portal = PortalOwner.createDefault('Door');
    world.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()), portal);
    const before = PreviewGeometrySignature.compute(world);
    portal.position.x += 2;
    PortalOwner.settingsWrite(portal, { ...portalSettingsCreateDefault(), width: 3, closed: true });
    world.add(RoomOwner.createDefault('Hall'));
    expect(PreviewGeometrySignature.compute(world)).toBe(before);
  });

  it('splits colors into sRGB channels from 0 to 1', () => {
    expect(previewLightColorChannels(0xffffff)).toEqual([1, 1, 1]);
    expect(previewLightColorChannels(0x000000)).toEqual([0, 0, 0]);
    const [red, green, blue] = previewLightColorChannels(0x336699);
    expect(red).toBeCloseTo(0x33 / 255);
    expect(green).toBeCloseTo(0x66 / 255);
    expect(blue).toBeCloseTo(0x99 / 255);
  });
});
