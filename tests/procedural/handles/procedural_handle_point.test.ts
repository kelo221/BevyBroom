import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ENTITY_HANDLE_SNAP_NONE, type EntityHandleSnap } from '@/entity/handles/entity_handle.js';
import { PROCEDURAL_GENERATOR_BOX_CORNER_B } from '@/procedural/generator/box/procedural_generator_box.js';
import { ProceduralParametersRead } from '@/procedural/generator/procedural_parameters_read.js';
import { ProceduralHandlePoint } from '@/procedural/handles/procedural_handle_point.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import type { ProceduralSettings } from '@/procedural/model/procedural_settings.js';
import { entityHandleTestViewsCreate } from '../../entity/handles/entity_handle_test_views.js';

/** Grid step of the snapping used by these tests, in meters. */
const GRID_STEP = 0.25;

/** Snapping to multiples of the grid step. */
const gridSnap: EntityHandleSnap = {
  snapValue: (value) => Math.round(value / GRID_STEP) * GRID_STEP,
  snapAngleRadians: (angle) => angle,
};

/**
 * Creates a box owner moved and turned away from the origin.
 *
 * @returns Owner and its settings.
 */
function boxCreate(): { owner: THREE.Group; settings: ProceduralSettings } {
  const owner = ProceduralOwner.createDefault('Box');
  owner.position.set(3, 1, -2);
  owner.rotation.set(0, Math.PI / 2, 0);
  owner.updateMatrixWorld(true);
  const settings = ProceduralOwner.settingsRead(owner);
  if (settings === null) throw new Error('missing settings');
  return { owner, settings };
}

const handle = new ProceduralHandlePoint(PROCEDURAL_GENERATOR_BOX_CORNER_B);

/**
 * Point handles move a point parameter with the pointer, snapped to the world
 * grid.
 */
describe('ProceduralHandlePoint', () => {
  it('sits on the point in world space in every view', () => {
    const { owner, settings } = boxCreate();
    const expected = owner.localToWorld(
      ProceduralParametersRead.vector3(settings.parameters, PROCEDURAL_GENERATOR_BOX_CORNER_B),
    );
    for (const { camera } of entityHandleTestViewsCreate(expected)) {
      expect(handle.worldPositionFor({ owner, camera }, settings).distanceTo(expected)).toBeLessThan(1e-9);
    }
  });

  it('drags on a plane through the point that faces the camera', () => {
    const { owner, settings } = boxCreate();
    const point = handle.worldPositionFor({ owner, camera: new THREE.Camera() }, settings);
    for (const { camera } of entityHandleTestViewsCreate(point)) {
      const plane = handle.dragPlaneFor({ owner, camera }, settings);
      expect(Math.abs(plane.distanceToPoint(point))).toBeLessThan(1e-9);
      expect(Math.abs(plane.normal.dot(camera.getWorldDirection(new THREE.Vector3())))).toBeGreaterThan(0.5);
    }
  });

  it('moves the point to the dragged position', () => {
    const { owner, settings } = boxCreate();
    const target = new THREE.Vector3(4.3, 2.2, -1.1);
    const dragged = handle.settingsDragged(
      { owner, camera: new THREE.Camera() },
      settings,
      target,
      ENTITY_HANDLE_SNAP_NONE,
    );
    const local = ProceduralParametersRead.vector3(dragged.parameters, PROCEDURAL_GENERATOR_BOX_CORNER_B);
    expect(owner.localToWorld(local).distanceTo(target)).toBeLessThan(1e-9);
  });

  it('snaps the world position of the point to the grid, even on a turned object', () => {
    const { owner, settings } = boxCreate();
    const target = new THREE.Vector3(4.37, 2.11, -1.62);
    const dragged = handle.settingsDragged({ owner, camera: new THREE.Camera() }, settings, target, gridSnap);
    const world = owner.localToWorld(
      ProceduralParametersRead.vector3(dragged.parameters, PROCEDURAL_GENERATOR_BOX_CORNER_B),
    );
    for (const coordinate of world.toArray()) {
      expect(Math.abs(coordinate / GRID_STEP - Math.round(coordinate / GRID_STEP))).toBeLessThan(1e-9);
    }
    expect(world.distanceTo(target)).toBeLessThanOrEqual((GRID_STEP / 2) * Math.sqrt(3));
  });

  it('changes only its own parameter', () => {
    const { owner, settings } = boxCreate();
    const dragged = handle.settingsDragged(
      { owner, camera: new THREE.Camera() },
      settings,
      new THREE.Vector3(9, 9, 9),
      ENTITY_HANDLE_SNAP_NONE,
    );
    const others = Object.keys(settings.parameters).filter((path) => path !== PROCEDURAL_GENERATOR_BOX_CORNER_B);
    expect(others.length).toBeGreaterThan(0);
    for (const path of others) {
      expect(dragged.parameters[path]).toEqual(settings.parameters[path]);
    }
    expect(dragged.materials).toEqual(settings.materials);
  });
});
