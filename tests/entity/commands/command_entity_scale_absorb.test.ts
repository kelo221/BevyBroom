import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { CommandStack } from '@/commands/command_stack.js';
import { entityScaleAbsorbCommandWrap } from '@/entity/commands/command_entity_scale_absorb.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { CommandTransformScaleSet } from '@/transform/commands/command_transform_scale_set.js';
import { GizmoRaycaster } from '@/transform/gizmo/gizmo_raycaster.js';
import { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import { HandlerTransform } from '@/transform/core/handler_transform.js';
import { TransformConstraint } from '@/transform/core/transform_constraint.js';
import { TransformExecutor } from '@/transform/core/transform_executor.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { TransformMode } from '@/types/transform_mode.js';

/**
 * Returns a light's stored radius.
 *
 * @param light Light owner.
 * @returns Radius in meters.
 */
function radiusRead(light: THREE.Object3D): number {
  return LightOwner.settingsRead(light)?.radius ?? Number.NaN;
}

/**
 * Types a scale factor into a single-use scale drag and confirms it.
 *
 * @param handler Transform handler.
 * @param objects Objects to scale.
 * @param digits Keys of the typed factor, such as ['2'].
 */
function typedScaleApply(handler: HandlerTransform, objects: THREE.Object3D[], digits: string[]): void {
  const pickElement = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
  const camera = new THREE.PerspectiveCamera();
  handler.beginSingleUseDrag(
    TransformMode.SCALE,
    objects,
    new THREE.Vector3(),
    camera,
    pickElement as unknown as HTMLElement,
    100,
    100,
  );
  for (const digit of digits) {
    handler.handleModalKeyDown(new KeyboardEvent('keydown', { code: `Digit${digit}`, key: digit }));
  }
  handler.handleModalKeyDown(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter' }));
}

/**
 * Covers turning the scale of lights into their radius as part of the scale
 * command's undo step.
 */
describe('CommandEntityScaleAbsorb', () => {
  it('turns a scale set on a light into its radius and undoes both in one step', () => {
    const light = LightOwner.createDefault('Light', 'point');
    const radius = radiusRead(light);
    const stack = new CommandStack(16);
    const scaleSet = new CommandTransformScaleSet([light], [new THREE.Vector3(2, 2, 2)]);
    stack.push(entityScaleAbsorbCommandWrap(scaleSet, [light]));
    expect(radiusRead(light)).toBeCloseTo(radius * 2);
    expect(light.scale.toArray()).toEqual([1, 1, 1]);
    expect(stack.getUndoCount()).toBe(1);
    stack.undo();
    expect(radiusRead(light)).toBeCloseTo(radius);
    expect(light.scale.toArray()).toEqual([1, 1, 1]);
    stack.redo();
    expect(radiusRead(light)).toBeCloseTo(radius * 2);
  });

  it('leaves the command alone when no object absorbs scale', () => {
    const mesh = new THREE.Mesh();
    const scaleSet = new CommandTransformScaleSet([mesh], [new THREE.Vector3(2, 2, 2)]);
    expect(entityScaleAbsorbCommandWrap(scaleSet, [mesh])).toBe(scaleSet);
  });

  it('changes the radius of a light scaled by typing a factor, and keeps scaling meshes next to it', () => {
    const commandStack = new CommandStack(16);
    const handler = new HandlerTransform(
      new GizmoTransform(Theme),
      new GizmoRaycaster(),
      new TransformExecutor(new GridSnap(false, 1)),
      new TransformConstraint(),
      commandStack,
    );
    const light = LightOwner.createDefault('Light', 'spot');
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    const radius = radiusRead(light);
    typedScaleApply(handler, [light, mesh], ['3']);
    expect(radiusRead(light)).toBeCloseTo(radius * 3);
    expect(light.scale.toArray()).toEqual([1, 1, 1]);
    expect(mesh.scale.x).toBeCloseTo(3);
    expect(commandStack.getUndoCount()).toBe(1);
    commandStack.undo();
    expect(radiusRead(light)).toBeCloseTo(radius);
    expect(mesh.scale.x).toBeCloseTo(1);
  });
});
