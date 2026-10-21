import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { ENTITY_HANDLE_SNAP_NONE, EntityHandle } from '@/entity/handles/entity_handle.js';
import { EntityHandleDragSession, type EntityHandleTarget } from '@/entity/handles/entity_handle_drag_session.js';
import { entityHandleTargetsOfOwner } from '@/entity/handles/entity_handle_targets.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { entityHandleTestRayToward, entityHandleTestViewsCreate } from './entity_handle_test_views.js';

/**
 * Creates a point light with fog and its radius handle, seen from above.
 *
 * @returns Light owner, radius handle target, top camera and undo stack.
 */
function dragSetup(): {
  owner: THREE.Group;
  target: EntityHandleTarget;
  camera: THREE.Camera;
  commandStack: CommandStack;
} {
  const owner = LightOwner.create('Lamp', { ...lightSettingsCreateDefault('point'), fogEnabled: true, fogRadius: 2 });
  owner.position.set(1, 2, 3);
  owner.updateMatrixWorld(true);
  const target = entityHandleTargetsOfOwner(owner)[0];
  const camera = entityHandleTestViewsCreate(owner.position)[0]?.camera;
  if (!target || !camera) {
    throw new Error('missing handle or camera');
  }
  return { owner, target, camera, commandStack: new CommandStack(16) };
}

/**
 * Returns the radius ball's position for a camera.
 *
 * @param setup Drag setup.
 * @returns World position.
 */
function ballOf(setup: ReturnType<typeof dragSetup>): THREE.Vector3 {
  const settings = setup.target.entityOwner.settingsRead(setup.owner) ?? {};
  return setup.target.handle.worldPositionFor({ owner: setup.owner, camera: setup.camera }, settings);
}

/**
 * Returns a light's radius or fails the test.
 *
 * @param owner Light owner.
 * @returns Radius.
 */
function radiusOf(owner: THREE.Object3D): number {
  return LightOwner.settingsRead(owner)?.radius ?? Number.NaN;
}

describe('EntityHandleDragSession', () => {
  it('writes the radius live and leaves one undo step that restores it', () => {
    const setup = dragSetup();
    const startRadius = radiusOf(setup.owner);
    const session = new EntityHandleDragSession(setup.commandStack, ENTITY_HANDLE_SNAP_NONE);
    expect(session.begin(setup.target, setup.camera, entityHandleTestRayToward(setup.camera, ballOf(setup)))).toBe(
      true,
    );
    const right = EntityHandle.cameraRightWorld(setup.camera);
    const goal = startRadius + 3;
    session.move(entityHandleTestRayToward(setup.camera, setup.owner.position.clone().addScaledVector(right, goal)));
    expect(radiusOf(setup.owner)).toBeCloseTo(goal, 6);
    session.end();
    expect(session.isActive()).toBe(false);
    expect(setup.commandStack.getUndoCount()).toBe(1);
    expect(radiusOf(setup.owner)).toBeCloseTo(goal, 6);
    setup.commandStack.undo();
    expect(radiusOf(setup.owner)).toBeCloseTo(startRadius, 6);
    expect(LightOwner.settingsRead(setup.owner)?.fogRadius).toBeCloseTo(2, 6);
  });

  it('keeps the ball under the pointer when it is grabbed off center', () => {
    const setup = dragSetup();
    const startRadius = radiusOf(setup.owner);
    const session = new EntityHandleDragSession(setup.commandStack, ENTITY_HANDLE_SNAP_NONE);
    const offCenter = ballOf(setup).add(new THREE.Vector3(0.05, 0, 0.05));
    const grab = entityHandleTestRayToward(setup.camera, offCenter);
    session.begin(setup.target, setup.camera, grab);
    session.move(grab);
    expect(radiusOf(setup.owner)).toBeCloseTo(startRadius, 6);
  });

  it('restores the settings on cancel and pushes nothing', () => {
    const setup = dragSetup();
    const startRadius = radiusOf(setup.owner);
    const session = new EntityHandleDragSession(setup.commandStack, ENTITY_HANDLE_SNAP_NONE);
    session.begin(setup.target, setup.camera, entityHandleTestRayToward(setup.camera, ballOf(setup)));
    session.move(entityHandleTestRayToward(setup.camera, setup.owner.position.clone()));
    expect(radiusOf(setup.owner)).not.toBeCloseTo(startRadius, 3);
    session.cancel();
    expect(radiusOf(setup.owner)).toBeCloseTo(startRadius, 6);
    expect(setup.commandStack.getUndoCount()).toBe(0);
  });

  it('pushes nothing for a press without movement', () => {
    const setup = dragSetup();
    const session = new EntityHandleDragSession(setup.commandStack, ENTITY_HANDLE_SNAP_NONE);
    session.begin(setup.target, setup.camera, entityHandleTestRayToward(setup.camera, ballOf(setup)));
    session.end();
    expect(setup.commandStack.getUndoCount()).toBe(0);
  });
});
