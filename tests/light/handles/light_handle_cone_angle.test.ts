import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ENTITY_HANDLE_SNAP_NONE } from '@/entity/handles/entity_handle.js';
import { LightHandleConeAngle } from '@/light/handles/light_handle_cone_angle.js';
import { LightOwner } from '@/light/model/light_owner.js';
import {
  LIGHT_MAX_CUTOFF_DEGREES,
  type LightSettings,
  lightSettingsCreateDefault,
} from '@/light/model/light_settings.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { entityHandleTestViewsCreate } from '../../entity/handles/entity_handle_test_views.js';

/**
 * Creates a spot light away from the origin.
 *
 * @param rotation Owner rotation.
 * @returns Owner, its settings and its world axis.
 */
function spotCreate(rotation: THREE.Euler): { owner: THREE.Group; settings: LightSettings; axis: THREE.Vector3 } {
  const owner = LightOwner.create('Spot', lightSettingsCreateDefault('spot'));
  owner.position.set(-3, 2, 5);
  owner.rotation.copy(rotation);
  owner.updateMatrixWorld(true);
  const settings = LightOwner.settingsRead(owner) ?? lightSettingsCreateDefault('spot');
  return { owner, settings, axis: new THREE.Vector3(0, 0, -1).applyQuaternion(owner.quaternion) };
}

/**
 * Returns a view's camera or fails the test.
 *
 * @param target Point looked at.
 * @param name View name.
 * @returns Camera.
 */
function cameraOf(target: THREE.Vector3, name: string): THREE.Camera {
  const camera = entityHandleTestViewsCreate(target).find((view) => view.name === name)?.camera;
  if (!camera) {
    throw new Error(`missing ${name} view`);
  }
  return camera;
}

/**
 * Returns the angle between the spot axis and the line from the light to a
 * point.
 *
 * @param owner Light owner.
 * @param axis World axis.
 * @param point World point.
 * @returns Angle in degrees.
 */
function angleFromAxis(owner: THREE.Object3D, axis: THREE.Vector3, point: THREE.Vector3): number {
  return THREE.MathUtils.radToDeg(point.clone().sub(owner.position).angleTo(axis));
}

const handle = new LightHandleConeAngle();

describe('LightHandleConeAngle', () => {
  it('puts the ball on the cone rim at the range sphere in every view', () => {
    const { owner, settings, axis } = spotCreate(new THREE.Euler(0.3, -0.7, 0.1));
    for (const { camera } of entityHandleTestViewsCreate(owner.position)) {
      const ball = handle.worldPositionFor({ owner, camera }, settings);
      expect(ball.distanceTo(owner.position)).toBeCloseTo(settings.radius, 6);
      expect(angleFromAxis(owner, axis, ball)).toBeCloseTo(settings.outerCutoffDegrees, 4);
      expect(handle.dragPlaneFor({ owner, camera }, settings).distanceToPoint(ball)).toBeCloseTo(0, 6);
    }
  });

  it('sets the outer angle to the dragged angle and keeps the inner share', () => {
    const { owner, settings, axis } = spotCreate(new THREE.Euler(0.3, -0.7, 0.1));
    const camera = cameraOf(owner.position, 'perspective');
    const plane = handle.dragPlaneFor({ owner, camera }, settings);
    const side = new THREE.Vector3().crossVectors(plane.normal, axis).normalize();
    const angle = THREE.MathUtils.degToRad(50);
    const dragged = owner.position
      .clone()
      .addScaledVector(axis, 2 * Math.cos(angle))
      .addScaledVector(side, 2 * Math.sin(angle));
    const next = handle.settingsDragged({ owner, camera }, settings, dragged, ENTITY_HANDLE_SNAP_NONE);
    expect(next.outerCutoffDegrees).toBeCloseTo(50, 4);
    expect(next.innerCutoffDegrees / next.outerCutoffDegrees).toBeCloseTo(
      settings.innerCutoffDegrees / settings.outerCutoffDegrees,
      6,
    );
    expect(next.radius).toBe(settings.radius);
  });

  it('drags on the rim plane when the axis points at the camera', () => {
    const { owner, settings, axis } = spotCreate(new THREE.Euler());
    const camera = cameraOf(owner.position, 'front');
    const plane = handle.dragPlaneFor({ owner, camera }, settings);
    expect(Math.abs(plane.normal.dot(axis))).toBeCloseTo(1, 6);
    const rimDistance = settings.radius * Math.cos(THREE.MathUtils.degToRad(settings.outerCutoffDegrees));
    const dragged = owner.position
      .clone()
      .addScaledVector(axis, rimDistance)
      .add(new THREE.Vector3(rimDistance, 0, 0));
    expect(plane.distanceToPoint(dragged)).toBeCloseTo(0, 6);
    const next = handle.settingsDragged({ owner, camera }, settings, dragged, ENTITY_HANDLE_SNAP_NONE);
    expect(next.outerCutoffDegrees).toBeCloseTo(45, 4);
  });

  it('snaps the angle to the rotation step and stays inside the allowed cone', () => {
    const { owner, settings, axis } = spotCreate(new THREE.Euler(0.3, -0.7, 0.1));
    const camera = cameraOf(owner.position, 'perspective');
    const side = new THREE.Vector3().crossVectors(handle.dragPlaneFor({ owner, camera }, settings).normal, axis);
    const at = (degrees: number): THREE.Vector3 => {
      const angle = THREE.MathUtils.degToRad(degrees);
      return owner.position.clone().addScaledVector(axis, Math.cos(angle)).addScaledVector(side, Math.sin(angle));
    };
    const snap = new GridSnap(true, 1);
    const steps =
      handle.settingsDragged({ owner, camera }, settings, at(37), snap).outerCutoffDegrees /
      snap.getRotationSnapDegrees();
    expect(steps).toBeCloseTo(Math.round(steps), 6);
    expect(steps).toBeGreaterThan(0);
    const back = handle.settingsDragged({ owner, camera }, settings, at(180), ENTITY_HANDLE_SNAP_NONE);
    expect(back.outerCutoffDegrees).toBeLessThanOrEqual(LIGHT_MAX_CUTOFF_DEGREES);
    const shut = handle.settingsDragged({ owner, camera }, settings, at(0), ENTITY_HANDLE_SNAP_NONE);
    expect(shut.outerCutoffDegrees).toBeGreaterThan(0);
  });
});
