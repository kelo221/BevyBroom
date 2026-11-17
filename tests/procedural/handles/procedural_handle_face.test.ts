import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { EntityHandleDragSession } from '@/entity/handles/entity_handle_drag_session.js';
import type { EntityHandleSnap } from '@/entity/handles/entity_handle.js';
import { entityHandleClientPointOf, entityHandleGrabAt } from '@/entity/handles/entity_handle_picker.js';
import { ENTITY_HANDLE_ARROW_PIXELS } from '@/entity/handles/entity_handle_axis.js';
import { entityHandleTargetsOfOwner } from '@/entity/handles/entity_handle_targets.js';
import type { EntityHandleTarget } from '@/entity/handles/entity_handle_drag_session.js';
import {
  PROCEDURAL_GENERATOR_BOX_CORNER_A,
  PROCEDURAL_GENERATOR_BOX_CORNER_B,
  PROCEDURAL_GENERATOR_BOX_MIN_SIZE,
} from '@/procedural/generator/box/procedural_generator_box.js';
import { ProceduralParametersRead } from '@/procedural/generator/procedural_parameters_read.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import type { ProceduralSettings } from '@/procedural/model/procedural_settings.js';
import {
  entityHandleTestRayToward,
  entityHandleTestViewsCreate,
} from '../../entity/handles/entity_handle_test_views.js';

/** Grid step of the snapping used by these tests, in meters. */
const GRID_STEP = 0.25;

/** Pixel size of the fake pane. */
const PANE_PIXELS = 400;

/** Snapping to multiples of the grid step. */
const gridSnap: EntityHandleSnap = {
  snapValue: (value) => Math.round(value / GRID_STEP) * GRID_STEP,
  snapAngleRadians: (angle) => angle,
};

/**
 * Creates a box owner away from the origin, optionally turned.
 *
 * @param turnRadians Rotation about world Y.
 * @returns Owner.
 */
function boxCreate(turnRadians = 0): THREE.Group {
  const owner = ProceduralOwner.createDefault('Box');
  owner.position.set(3, 1, -2);
  owner.rotation.set(0, turnRadians, 0);
  owner.updateMatrixWorld(true);
  return owner;
}

/**
 * Returns the settings of an owner.
 *
 * @param owner Box owner.
 * @returns Settings.
 */
function settingsOf(owner: THREE.Object3D): ProceduralSettings {
  const settings = ProceduralOwner.settingsRead(owner);
  if (settings === null) throw new Error('missing settings');
  return settings;
}

/**
 * Finds the face handle target of one side and axis.
 *
 * @param owner Box owner.
 * @param face Side and axis, such as max_y.
 * @returns Handle target.
 */
function faceTarget(owner: THREE.Group, face: string): EntityHandleTarget {
  const target = entityHandleTargetsOfOwner(owner).find((candidate) => candidate.handle.handleName.endsWith(face));
  if (!target) throw new Error(`missing ${face} handle`);
  return target;
}

/**
 * Returns the owner-space box of the corners.
 *
 * @param owner Box owner.
 * @returns Box.
 */
function boxOf(owner: THREE.Object3D): THREE.Box3 {
  const parameters = settingsOf(owner).parameters;
  return new THREE.Box3().setFromPoints([
    ProceduralParametersRead.vector3(parameters, PROCEDURAL_GENERATOR_BOX_CORNER_A),
    ProceduralParametersRead.vector3(parameters, PROCEDURAL_GENERATOR_BOX_CORNER_B),
  ]);
}

/**
 * Drags a handle in a view from its position by a world offset.
 *
 * @param target Handle target.
 * @param camera View camera.
 * @param offset World offset of the pointer.
 * @param axis Grabbed arrow, or null for the ball.
 */
function handleDrag(
  target: EntityHandleTarget,
  camera: THREE.Camera,
  offset: THREE.Vector3,
  axis: THREE.Vector3 | null,
): void {
  const view = { owner: target.owner, camera };
  const start = target.handle.worldPositionFor(view, settingsOf(target.owner));
  const session = new EntityHandleDragSession(new CommandStack(8), gridSnap);
  session.begin(target, camera, entityHandleTestRayToward(camera, start), axis);
  session.move(entityHandleTestRayToward(camera, start.clone().add(offset)));
  session.end();
}

/**
 * Face handles sit in the middle of each box face with an arrow along its
 * outward normal and move only their face, snapped to the grid.
 */
describe('ProceduralHandleFace', () => {
  it('sits in the middle of its face with an arrow along the outward normal, turning with the box', () => {
    const owner = boxCreate(Math.PI / 2);
    const target = faceTarget(owner, 'max_x');
    const view = { owner, camera: new THREE.Camera() };
    const box = boxOf(owner);
    const expectedLocal = box.getCenter(new THREE.Vector3()).setX(box.max.x);
    expect(
      target.handle.worldPositionFor(view, settingsOf(owner)).distanceTo(owner.localToWorld(expectedLocal)),
    ).toBeLessThan(1e-9);
    const [normal] = target.handle.axesFor(view, settingsOf(owner));
    expect(normal?.distanceTo(new THREE.Vector3(0, 0, -1))).toBeLessThan(1e-9);
  });

  it('moves only its own face along the normal, snapped, whatever way the ball is dragged', () => {
    const owner = boxCreate();
    const before = boxOf(owner);
    const front = entityHandleTestViewsCreate(owner.position)[1]?.camera ?? new THREE.Camera();
    handleDrag(faceTarget(owner, 'max_y'), front, new THREE.Vector3(0.8, 1.37, 0), null);
    const after = boxOf(owner);
    expect(after.max.y).toBeCloseTo(
      gridSnap.snapValue(owner.localToWorld(before.max.clone()).y + 1.37) - owner.position.y,
      9,
    );
    expect(after.min.toArray()).toEqual(before.min.toArray());
    expect([after.max.x, after.max.z]).toEqual([before.max.x, before.max.z]);
  });

  it('stops a face the smallest size before the opposite face', () => {
    const owner = boxCreate();
    const before = boxOf(owner);
    const front = entityHandleTestViewsCreate(owner.position)[1]?.camera ?? new THREE.Camera();
    handleDrag(faceTarget(owner, 'min_y'), front, new THREE.Vector3(0, 50, 0), null);
    expect(boxOf(owner).min.y).toBeCloseTo(before.max.y - PROCEDURAL_GENERATOR_BOX_MIN_SIZE, 9);
  });

  it('is grabbed by its arrow in a view that shows the normal and not in one that looks along it', () => {
    const owner = boxCreate();
    const target = faceTarget(owner, 'max_y');
    const views = entityHandleTestViewsCreate(owner.position);
    const element = document.createElement('div');
    element.getBoundingClientRect = () => new DOMRect(0, 0, PANE_PIXELS, PANE_PIXELS);
    for (const [viewName, expectsArrow] of [
      ['front', true],
      ['top', false],
    ] as const) {
      const camera = views.find((view) => view.name === viewName)?.camera ?? new THREE.Camera();
      const pane = { camera, element };
      const ball = entityHandleClientPointOf(target, pane) ?? new THREE.Vector2();
      const alongArrow = ball.clone().add(new THREE.Vector2(0, -ENTITY_HANDLE_ARROW_PIXELS * 0.6));
      const grab = entityHandleGrabAt([target], {
        ...pane,
        event: new MouseEvent('pointerdown', { clientX: alongArrow.x, clientY: alongArrow.y }),
      });
      expect(grab?.axis !== undefined && grab?.axis !== null).toBe(expectsArrow);
    }
  });
});
