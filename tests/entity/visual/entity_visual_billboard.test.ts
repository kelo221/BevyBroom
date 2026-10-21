import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EntityVisualBillboard } from '@/entity/visual/entity_visual_billboard.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { ICON_NAMES } from '@/ui/icons/icon_name.js';

/**
 * Builds a camera looking at a point from a direction.
 *
 * @param target Point the camera looks at.
 * @param offset Camera position relative to the target.
 * @returns Camera with an updated world matrix.
 */
function cameraLookingAt(target: THREE.Vector3, offset: THREE.Vector3): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.copy(target).add(offset);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * Returns the icon billboard of an owner or fails the test.
 *
 * @param owner Entity owner.
 * @returns The icon mesh.
 */
function iconRead(owner: THREE.Object3D): THREE.Mesh {
  const icon = EntityVisualBillboard.iconFind(owner);
  if (!icon) {
    throw new Error('owner has no icon');
  }
  return icon;
}

/** Entity icons are flat camera-facing billboards with a fixed size in meters. */
describe('EntityVisualBillboard', () => {
  it('builds a one meter icon geometry centered on the origin for every icon', () => {
    for (const iconName of ICON_NAMES) {
      const geometry = EntityVisualBillboard.geometryOf(iconName);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox ?? new THREE.Box3();
      expect(box.isEmpty(), iconName).toBe(false);
      expect(box.min.x).toBeGreaterThanOrEqual(-0.5 - 1e-6);
      expect(box.max.y).toBeLessThanOrEqual(0.5 + 1e-6);
      expect(EntityVisualBillboard.geometryOf(iconName)).toBe(geometry);
    }
  });

  it('faces the camera and drops the rotation and scale of its parent', () => {
    const owner = LightOwner.createDefault('Lamp', 'point');
    const parent = new THREE.Group();
    parent.position.set(3, 1, -2);
    parent.rotation.set(0.4, 1.1, -0.3);
    parent.scale.set(4, 0.5, 2);
    parent.add(owner);
    parent.updateMatrixWorld(true);
    const icon = iconRead(owner);
    const sizeMeters = 0.6;
    const ownerWorld = owner.getWorldPosition(new THREE.Vector3());
    const camera = cameraLookingAt(ownerWorld, new THREE.Vector3(5, 7, 9));
    EntityVisualBillboard.faceCamera(icon, camera, sizeMeters);
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    icon.matrixWorld.decompose(position, rotation, scale);
    expect(position.distanceTo(ownerWorld)).toBeLessThan(1e-6);
    expect(rotation.angleTo(camera.getWorldQuaternion(new THREE.Quaternion()))).toBeLessThan(1e-6);
    expect(scale.distanceTo(new THREE.Vector3(sizeMeters, sizeMeters, sizeMeters))).toBeLessThan(1e-6);
  });

  it('keeps one icon across refreshes and switches it when a light turns from point to spot', () => {
    const owner = LightOwner.createDefault('Lamp', 'point');
    const icon = iconRead(owner);
    LightOwner.settingsWrite(owner, lightSettingsCreateDefault('spot'));
    const spotIcon = LightOwner.definition.iconName(lightSettingsCreateDefault('spot'));
    expect(iconRead(owner)).toBe(icon);
    expect(icon.geometry).toBe(EntityVisualBillboard.geometryOf(spotIcon));
    expect(owner.children.filter((child) => child === icon)).toHaveLength(1);
  });

  it('is never the clickable marker', () => {
    const owner = LightOwner.createDefault('Lamp', 'point');
    expect(LightOwner.markerOf(owner)).not.toBe(iconRead(owner));
  });
});
