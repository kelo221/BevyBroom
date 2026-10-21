import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ENTITY_HANDLE_SNAP_NONE, EntityHandle } from '@/entity/handles/entity_handle.js';
import { LightHandleRadius } from '@/light/handles/light_handle_radius.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { LIGHT_MIN_RADIUS, type LightSettings, lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { entityHandleTestViewsCreate } from '../../entity/handles/entity_handle_test_views.js';

/**
 * Creates a light away from the origin with fog, so fog scaling shows.
 *
 * @param kind Point or spot.
 * @param rotation Owner rotation.
 * @returns Owner and its settings.
 */
function lightCreate(
  kind: 'point' | 'spot',
  rotation = new THREE.Euler(),
): { owner: THREE.Group; settings: LightSettings } {
  const defaults = lightSettingsCreateDefault(kind);
  const settings = { ...defaults, fogEnabled: true, fogRadius: defaults.radius / 2 };
  const owner = LightOwner.create('Lamp', settings);
  owner.position.set(2, 3, -4);
  owner.rotation.copy(rotation);
  owner.updateMatrixWorld(true);
  return { owner, settings: LightOwner.settingsRead(owner) ?? settings };
}

/**
 * Returns the distance between a point and the light's center as seen on
 * screen, in normalized device units.
 *
 * @param camera Viewing camera.
 * @param center Light center.
 * @param point Handle position.
 * @returns Screen distance.
 */
function screenDistance(camera: THREE.Camera, center: THREE.Vector3, point: THREE.Vector3): number {
  const a = center.clone().project(camera);
  const b = point.clone().project(camera);
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const handle = new LightHandleRadius();

describe('LightHandleRadius', () => {
  it('puts a point light ball on its range sphere, away from the light on screen, in every view', () => {
    const { owner, settings } = lightCreate('point');
    for (const { camera } of entityHandleTestViewsCreate(owner.position)) {
      const ball = handle.worldPositionFor({ owner, camera }, settings);
      expect(ball.distanceTo(owner.position)).toBeCloseTo(settings.radius, 6);
      expect(screenDistance(camera, owner.position, ball)).toBeGreaterThan(0.05);
      expect(ball.clone().sub(owner.position).dot(EntityHandle.cameraRightWorld(camera))).toBeGreaterThan(0);
    }
  });

  it('sets the radius of a point light to the dragged distance and scales the fog with it', () => {
    const { owner, settings } = lightCreate('point');
    for (const { camera } of entityHandleTestViewsCreate(owner.position)) {
      const target = settings.radius * 1.6;
      const dragged = owner.position.clone().addScaledVector(EntityHandle.cameraRightWorld(camera), target);
      const next = handle.settingsDragged({ owner, camera }, settings, dragged, ENTITY_HANDLE_SNAP_NONE);
      expect(next.radius).toBeCloseTo(target, 6);
      expect(next.fogRadius / next.radius).toBeCloseTo(settings.fogRadius / settings.radius, 6);
      expect(handle.dragPlaneFor({ owner, camera }, settings).distanceToPoint(owner.position)).toBeCloseTo(0, 6);
    }
  });

  it('puts a spot ball at the tip of a sideways axis and measures the radius along it', () => {
    const { owner, settings } = lightCreate('spot', new THREE.Euler(0.4, 0.9, 0.2));
    const axis = new THREE.Vector3(0, 0, -1).applyQuaternion(owner.quaternion);
    const camera = entityHandleTestViewsCreate(owner.position).find((view) => view.name === 'perspective')?.camera;
    if (!camera) {
      throw new Error('missing perspective view');
    }
    const ball = handle.worldPositionFor({ owner, camera }, settings);
    expect(ball.distanceTo(owner.position.clone().addScaledVector(axis, settings.radius))).toBeCloseTo(0, 6);
    expect(handle.dragPlaneFor({ owner, camera }, settings).normal.dot(axis)).toBeCloseTo(0, 6);
    const across = new THREE.Vector3().crossVectors(axis, handle.dragPlaneFor({ owner, camera }, settings).normal);
    const dragged = owner.position.clone().addScaledVector(axis, 3.5).addScaledVector(across, 2);
    expect(handle.settingsDragged({ owner, camera }, settings, dragged, ENTITY_HANDLE_SNAP_NONE).radius).toBeCloseTo(
      3.5,
      6,
    );
  });

  it('moves a spot ball off the axis when the axis points at the camera', () => {
    const { owner, settings } = lightCreate('spot');
    const camera = entityHandleTestViewsCreate(owner.position).find((view) => view.name === 'front')?.camera;
    if (!camera) {
      throw new Error('missing front view');
    }
    const ball = handle.worldPositionFor({ owner, camera }, settings);
    expect(screenDistance(camera, owner.position, ball)).toBeGreaterThan(0.05);
    expect(ball.distanceTo(owner.position)).toBeCloseTo(settings.radius, 6);
  });

  it('snaps the radius to the grid and never goes below the smallest radius', () => {
    const { owner, settings } = lightCreate('point');
    const camera = entityHandleTestViewsCreate(owner.position)[0]?.camera ?? new THREE.PerspectiveCamera();
    const right = EntityHandle.cameraRightWorld(camera);
    const snap = new GridSnap(true, 0.5);
    const snapped = handle.settingsDragged(
      { owner, camera },
      settings,
      owner.position.clone().addScaledVector(right, 3.3),
      snap,
    );
    expect(snapped.radius).toBeCloseTo(3.5, 6);
    const collapsed = handle.settingsDragged(
      { owner, camera },
      settings,
      owner.position.clone(),
      ENTITY_HANDLE_SNAP_NONE,
    );
    expect(collapsed.radius).toBe(LIGHT_MIN_RADIUS);
  });
});
