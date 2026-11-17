import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EXPORT_OBJECT_IDENTITY_EXTRAS_KEY } from '@/io/scene/builder_export_scene.js';
import { ProceduralBuild } from '@/procedural/build/procedural_build.js';
import { ProceduralExportPartBuilder } from '@/procedural/export/procedural_export_part_builder.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import { ProceduralSettingsRules } from '@/procedural/model/procedural_settings_rules.js';

/** Every generated part is exported as its own named static mesh. */
describe('ProceduralExportPartBuilder', () => {
  it('exports one mesh per part with stable identities and lightmap UVs on request', () => {
    const settings = ProceduralSettingsRules.createDefault();
    const owner = ProceduralOwner.create('Box', settings);
    const parts = ProceduralBuild.partsOf(settings) ?? [];
    const meshes = ProceduralExportPartBuilder.meshesCreate(owner, settings, { includeLightmapUvs: true }) ?? [];
    expect(meshes.map((mesh) => mesh.name)).toEqual(parts.map((part) => part.name));
    const again = ProceduralExportPartBuilder.meshesCreate(owner, settings, {}) ?? [];
    expect(meshes.map((mesh) => mesh.userData[EXPORT_OBJECT_IDENTITY_EXTRAS_KEY])).toEqual(
      again.map((mesh) => mesh.userData[EXPORT_OBJECT_IDENTITY_EXTRAS_KEY]),
    );
    expect(new Set(meshes.map((mesh) => mesh.userData[EXPORT_OBJECT_IDENTITY_EXTRAS_KEY])).size).toBe(meshes.length);
    for (const mesh of meshes) {
      expect(mesh.geometry.getAttribute('uv1')).toBeDefined();
      expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
    }
  });

  it('exports nothing for a generator the editor does not know', () => {
    const settings = { generatorId: 'unknown', generatorVersion: 1, parameters: {}, materials: {} };
    expect(ProceduralExportPartBuilder.meshesCreate(new THREE.Group(), settings, {})).toBeNull();
  });
});
