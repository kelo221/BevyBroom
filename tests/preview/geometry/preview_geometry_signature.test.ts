import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PreviewGeometrySignature } from '@/preview/geometry/preview_geometry_signature.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { materialIdentityWrite } from '@/materials/identity/material_identity.js';

/**
 * Builds a world with one box mesh.
 *
 * @returns The world and its mesh.
 */
function createWorldWithBox(): { world: THREE.Group; box: THREE.Mesh } {
  const world = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  world.add(box);
  return { world, box };
}

/** The geometry signature changes exactly when exported geometry would change. */
describe('PreviewGeometrySignature', () => {
  it('ignores transforms, visibility and lights', () => {
    const { world, box } = createWorldWithBox();
    const before = PreviewGeometrySignature.compute(world);
    box.position.set(4, 5, 6);
    box.visible = false;
    const light = LightOwner.createDefault('Lamp', 'point');
    world.add(light);
    LightOwner.settingsWrite(light, { ...lightSettingsCreateDefault('spot'), radius: 20 });
    expect(PreviewGeometrySignature.compute(world)).toBe(before);
  });

  it('changes when vertices are edited', () => {
    const { world, box } = createWorldWithBox();
    const before = PreviewGeometrySignature.compute(world);
    const positions = box.geometry.getAttribute('position');
    positions.setX(0, positions.getX(0) + 1);
    positions.needsUpdate = true;
    expect(PreviewGeometrySignature.compute(world)).not.toBe(before);
  });

  it('changes when a material is replaced or a mesh is added', () => {
    const { world, box } = createWorldWithBox();
    const before = PreviewGeometrySignature.compute(world);
    const material = new THREE.MeshBasicMaterial();
    materialIdentityWrite(material, 'stone/wall');
    box.material = material;
    const afterMaterial = PreviewGeometrySignature.compute(world);
    expect(afterMaterial).not.toBe(before);
    world.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    expect(PreviewGeometrySignature.compute(world)).not.toBe(afterMaterial);
  });
});
