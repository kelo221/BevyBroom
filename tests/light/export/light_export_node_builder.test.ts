import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import { buildExportScene, EXPORT_OBJECT_IDENTITY_EXTRAS_KEY } from '@/io/scene/builder_export_scene.js';
import {
  LIGHT_EXPORT_COLOR_EXTRAS_KEY,
  LIGHT_EXPORT_EFFECT_EXTRAS_KEY,
  LIGHT_EXPORT_FOG_EXTRAS_KEY,
  LIGHT_EXPORT_TYPE_EXTRAS_KEY,
} from '@/light/export/light_export_node_builder.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault, type LightSettings } from '@/light/model/light_settings.js';
import { previewLightColorChannels } from '@/preview/state/preview_state_light_converter_color.js';
import { glbJsonRead } from '../../io/glb/glb_json_read.js';

/**
 * Creates a spot light with a candle effect and cone fog, placed and turned
 * away from the origin.
 *
 * @returns The world, the light and its settings.
 */
function spotWorldCreate(): { world: THREE.Group; spot: THREE.Group; settings: LightSettings } {
  const world = new THREE.Group();
  const settings: LightSettings = {
    ...lightSettingsCreateDefault('spot'),
    colorHex: 0x3366ff,
    radius: 7.5,
    effectKind: 'candle',
    fogEnabled: true,
    fogShape: 'cone_z',
  };
  const spot = LightOwner.create('Spot', settings);
  spot.position.set(2, 3, -1);
  spot.rotation.set(-0.4, 0.9, 0);
  world.add(spot);
  return { world, spot, settings };
}

/**
 * Finds the export group of the editor object `id`.
 *
 * @param exported The export scene.
 * @param id The editor object id.
 * @returns The export group, or undefined.
 */
function exportGroupFind(exported: THREE.Object3D, id: string): THREE.Object3D | undefined {
  return exported.children.find((child) => child.userData[EXPORT_OBJECT_IDENTITY_EXTRAS_KEY] === id);
}

/**
 * Game exports describe lights with DynLight node extras so a shipped level is
 * lit without the editor, while the light's editor visuals never become
 * meshes.
 */
describe('light export nodes', () => {
  it('leaves lights out unless the export asks for them', () => {
    const { world } = spotWorldCreate();
    expect(buildExportScene(world).children).toHaveLength(0);
  });

  it('writes the light settings as DynLight extras under the light transform', () => {
    const { world, spot, settings } = spotWorldCreate();
    const exported = buildExportScene(world, { includeLightNodes: true });
    const group = exportGroupFind(exported, spot.uuid);
    const node = group?.children[0];
    expect(group?.position.distanceTo(spot.position)).toBeLessThan(1e-6);
    expect(group?.quaternion.angleTo(spot.quaternion)).toBeLessThan(1e-6);
    expect(group?.children).toHaveLength(1);
    expect(node?.userData[LIGHT_EXPORT_TYPE_EXTRAS_KEY]).toBe('spot');
    expect(node?.userData[LIGHT_EXPORT_COLOR_EXTRAS_KEY]).toEqual(previewLightColorChannels(settings.colorHex));
    expect(node?.userData['dynlight_radius']).toBe(settings.radius);
    expect(node?.userData['dynlight_outer_cutoff']).toBe(settings.outerCutoffDegrees);
    expect(node?.userData[LIGHT_EXPORT_EFFECT_EXTRAS_KEY]).toBe('candle');
    expect(node?.userData[LIGHT_EXPORT_FOG_EXTRAS_KEY]).toBe('cone_z');
  });

  it('cancels the owner scale because the radius already stands for it', () => {
    const { world, spot } = spotWorldCreate();
    spot.scale.setScalar(2);
    const node = exportGroupFind(buildExportScene(world, { includeLightNodes: true }), spot.uuid)?.children[0];
    const worldScale = new THREE.Vector3(2, 2, 2).multiply(node?.scale ?? new THREE.Vector3());
    expect(worldScale.distanceTo(new THREE.Vector3(1, 1, 1))).toBeLessThan(1e-6);
  });

  it('leaves out disabled lights', () => {
    const { world, spot, settings } = spotWorldCreate();
    LightOwner.settingsWrite(spot, { ...settings, enabled: false });
    expect(buildExportScene(world, { includeLightNodes: true }).children).toHaveLength(0);
  });

  it('carries the light extras into the file export without any light mesh', async () => {
    const { world } = spotWorldCreate();
    const json = glbJsonRead(await new GlbExporter().exportForFile(world));
    const extras = (json.nodes ?? []).map((node) => node.extras ?? {});
    expect(extras.some((entry) => entry[LIGHT_EXPORT_TYPE_EXTRAS_KEY] === 'spot')).toBe(true);
    expect((json.meshes ?? []).length).toBe(0);
  });
});
