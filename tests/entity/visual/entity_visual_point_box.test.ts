import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { entityOwnerOfPart, entityPickMeshIs } from '@/entity/model/entity_owner_keys.js';
import { EntityVisualBillboard } from '@/entity/visual/entity_visual_billboard.js';
import { ENTITY_POINT_BOX_SIZE } from '@/entity/visual/entity_visual_point_box.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { BuilderOrientedBounds } from '@/transform/bounds/builder_oriented_bounds.js';
import { isEditorHelperObject } from '@/utils/mesh_edge_sync.js';

/**
 * Returns the marker of a light or fails the test.
 *
 * @param owner Light owner.
 * @returns The marker mesh.
 */
function markerRead(owner: THREE.Object3D): THREE.Mesh {
  const marker = LightOwner.markerOf(owner);
  if (!marker) {
    throw new Error('light has no marker');
  }
  return marker;
}

/**
 * Collects the meshes a click could select, the way the viewports do.
 *
 * @param root Scene root.
 * @returns Selectable meshes.
 */
function selectableMeshesCollect(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((child) => {
    if (child instanceof THREE.Mesh && (!isEditorHelperObject(child) || entityPickMeshIs(child))) {
      meshes.push(child);
    }
  });
  return meshes;
}

/** Point entities are clicked and moved through a small solid box. */
describe('EntityVisualPointBox', () => {
  it('gives a light selection bounds that are a cube of the box size in every view', () => {
    const owner = LightOwner.create('Lamp', lightSettingsCreateDefault('spot'));
    owner.position.set(2, 3, -1);
    owner.rotation.set(-Math.PI / 2, 0, 0);
    owner.updateMatrixWorld(true);
    const bounds = new BuilderOrientedBounds().buildFromMeshes([markerRead(owner)]);
    const halfSize = ENTITY_POINT_BOX_SIZE / 2;
    expect(bounds?.halfExtents.x).toBeCloseTo(halfSize);
    expect(bounds?.halfExtents.y).toBeCloseTo(halfSize);
    expect(bounds?.halfExtents.z).toBeCloseTo(halfSize);
    expect(bounds?.center.distanceTo(owner.position)).toBeLessThan(1e-6);
  });

  it('is hit from any side and resolves to its owner, while the icon is never selectable', () => {
    const owner = LightOwner.create('Lamp', lightSettingsCreateDefault('point'));
    owner.position.set(-2, 4, 1);
    owner.updateMatrixWorld(true);
    expect(selectableMeshesCollect(owner)).toEqual([markerRead(owner)]);
    for (const direction of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 1, 1)]) {
      const origin = owner.position.clone().addScaledVector(direction.normalize(), 10);
      const raycaster = new THREE.Raycaster(origin, owner.position.clone().sub(origin).normalize());
      const hit = raycaster.intersectObject(markerRead(owner), false)[0];
      expect(hit ? entityOwnerOfPart(hit.object) : null).toBe(owner);
    }
  });

  it('tints the box and icon with the light color and fades a disabled light', () => {
    const settings = { ...lightSettingsCreateDefault('point'), colorHex: 0x33aa55 };
    const owner = LightOwner.create('Lamp', settings);
    const iconMaterial = EntityVisualBillboard.iconFind(owner)?.material as THREE.MeshBasicMaterial;
    expect(iconMaterial.color.getHex()).toBe(settings.colorHex);
    const enabledOpacity = iconMaterial.opacity;
    LightOwner.settingsWrite(owner, { ...settings, enabled: false });
    expect(iconMaterial.opacity).toBeLessThan(enabledOpacity);
    expect((markerRead(owner).material as THREE.MeshBasicMaterial).color.getHex()).toBe(settings.colorHex);
  });

  it('gives game entities the same box marker', () => {
    const owner = GameEntityOwner.create('Spawn', GameEntityOwner.definition.settingsCreateDefault());
    const marker = GameEntityOwner.markerOf(owner);
    marker?.geometry.computeBoundingBox();
    const size = marker?.geometry.boundingBox?.getSize(new THREE.Vector3());
    expect(size?.x).toBeCloseTo(ENTITY_POINT_BOX_SIZE);
    expect(size?.y).toBeCloseTo(ENTITY_POINT_BOX_SIZE);
    expect(size?.z).toBeCloseTo(ENTITY_POINT_BOX_SIZE);
  });
});
