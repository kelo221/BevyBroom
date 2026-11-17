import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ExportGeometryMaterialFilter } from '@/io/scene/export_geometry_material_filter.js';
import { materialIdentityRead, materialIdentityWrite } from '@/materials/identity/material_identity.js';

/**
 * Returns a material carrying a texture identity.
 *
 * @param identifier Material identity.
 * @returns Material.
 */
function materialOf(identifier: string): THREE.Material {
  const material = new THREE.MeshBasicMaterial();
  materialIdentityWrite(material, identifier);
  return material;
}

/** Tool texture faces are left out of exported geometry. */
describe('ExportGeometryMaterialFilter', () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const trianglesPerSide = 2;

  it('keeps the geometry untouched when nothing is omitted', () => {
    expect(ExportGeometryMaterialFilter.filter(geometry, materialOf('wall'), () => false)).toBe(geometry);
  });

  it('drops the groups of omitted materials and keeps the rest', () => {
    const materials = ['wall', 'nodraw', 'wall', 'wall', 'nodraw', 'wall'].map(materialOf);
    const filtered = ExportGeometryMaterialFilter.filter(geometry, materials, (identifier) => identifier === 'nodraw');
    const keptSides = materials.filter((material) => materialIdentityRead(material) !== 'nodraw').length;
    expect(filtered?.getIndex()?.count).toBe(keptSides * trianglesPerSide * 3);
    expect(filtered?.groups.every((group) => materials[group.materialIndex ?? 0] !== undefined)).toBe(true);
    expect(geometry.getIndex()?.count).toBe(6 * trianglesPerSide * 3);
  });

  it('returns null when every face is omitted', () => {
    const whole = geometry.clone();
    whole.clearGroups();
    expect(ExportGeometryMaterialFilter.filter(whole, materialOf('nodraw'), () => true)).toBeNull();
  });
});
