import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LightOwner } from '@/light/model/light_owner.js';
import { entityOwnerOfPart, entityPickMeshIs, entityVisualPartIs } from '@/entity/model/entity_owner_keys.js';
import { isLightOwner } from '@/light/model/light_owner_keys.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { isEditorHelperObject } from '@/utils/mesh_edge_sync.js';

/**
 * Collects the names of an owner's visual parts.
 *
 * @param owner Light owner.
 * @returns Part names in child order.
 */
function visualPartNames(owner: THREE.Object3D): string[] {
  return owner.children.filter((child) => entityVisualPartIs(child)).map((child) => child.name);
}

/**
 * A light owner is a flagged group whose settings live in userData and whose
 * editor-only visuals follow those settings.
 */
describe('light owner', () => {
  it('creates a flagged group with a pick marker that resolves back to the owner', () => {
    const owner = LightOwner.createDefault('Lamp', 'point');
    const marker = LightOwner.markerOf(owner);
    expect(isLightOwner(owner)).toBe(true);
    expect(marker).not.toBeNull();
    if (!marker) return;
    expect(entityPickMeshIs(marker)).toBe(true);
    expect(entityOwnerOfPart(marker)).toBe(owner);
    expect(isEditorHelperObject(marker)).toBe(true);
  });

  it('shows a range for points and adds a cone for spots', () => {
    const point = LightOwner.createDefault('Point', 'point');
    const spot = LightOwner.createDefault('Spot', 'spot');
    expect(visualPartNames(point)).toContain('Light Range');
    expect(visualPartNames(point)).not.toContain('Light Cone');
    expect(visualPartNames(spot)).toContain('Light Cone');
  });

  it('keeps the same marker and rebuilds guides when settings change', () => {
    const owner = LightOwner.createDefault('Lamp', 'point');
    const markerBefore = LightOwner.markerOf(owner);
    const settings = lightSettingsCreateDefault('spot');
    LightOwner.settingsWrite(owner, { ...settings, radius: settings.radius * 2 });
    expect(LightOwner.markerOf(owner)).toBe(markerBefore);
    expect(LightOwner.settingsRead(owner)?.radius).toBeCloseTo(settings.radius * 2);
    expect(visualPartNames(owner).filter((name) => name === 'Light Range')).toHaveLength(1);
    expect(visualPartNames(owner)).toContain('Light Cone');
  });

  it('returns independent settings copies and nothing for ordinary objects', () => {
    const owner = LightOwner.createDefault('Lamp', 'point');
    const read = LightOwner.settingsRead(owner);
    if (read) read.intensity += 10;
    expect(LightOwner.settingsRead(owner)?.intensity).toBe(lightSettingsCreateDefault('point').intensity);
    expect(LightOwner.settingsRead(new THREE.Group())).toBeNull();
  });

  it('tints the marker with the light color', () => {
    const owner = LightOwner.create('Red', { ...lightSettingsCreateDefault('point'), colorHex: 0xff0000 });
    const material = LightOwner.markerOf(owner)?.material;
    expect(material).toBeInstanceOf(THREE.MeshBasicMaterial);
    if (material instanceof THREE.MeshBasicMaterial) {
      expect(material.color.getHex()).toBe(0xff0000);
    }
  });
});
