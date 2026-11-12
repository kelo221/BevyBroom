import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';
import { modifierBevelRefreshScene } from '@/modifier/compile/modifier_bevel_scene_refresh.js';
import type { ModifierStackVolumeOperation } from '@/modifier/stack/modifier_stack_types.js';
import { stackResultBounds } from './modifier_stack_fixture.js';

/**
 * Builds a world with one additive box brush and a box volume that covers the
 * brush's +X half, first without an operation and then with the given one, the
 * same order an editor edit produces.
 *
 * @param operation Volume operation to store after the first compile.
 * @returns Solid model and the compiled-then-edited volume.
 */
function operationEditScene(operation: ModifierStackVolumeOperation) {
  const world = new THREE.Group();
  const model = new SolidModel('Operation cut test');
  world.add(model.root);
  model.addBoxBrush(2, SolidOperation.Additive);
  const volume = ModifierVolume.create({ modifiers: [] });
  volume.position.set(1, 0, 0);
  volume.scale.set(2, 4, 4);
  world.add(volume);
  world.updateMatrixWorld(true);
  modifierBevelRefreshScene(world);
  ModifierVolume.write(volume, { ...ModifierVolume.read(volume), operation });
  modifierBevelRefreshScene(world);
  return { model };
}

describe('modifier volume operation cut', () => {
  it('keeps the solid when the volume operation is none', () => {
    const scene = operationEditScene('none');
    const result = stackResultBounds(scene.model);
    expect(result.min.x).toBeCloseTo(-1, 3);
    expect(result.max.x).toBeCloseTo(1, 3);
  });

  it('removes the covered +X half when the operation is subtract', () => {
    const scene = operationEditScene('subtract');
    const result = stackResultBounds(scene.model);
    expect(result.min.x).toBeCloseTo(-1, 3);
    expect(result.max.x).toBeCloseTo(0, 3);
  });

  it('keeps only the covered +X half when the operation is intersect', () => {
    const scene = operationEditScene('intersect');
    const result = stackResultBounds(scene.model);
    expect(result.min.x).toBeCloseTo(0, 3);
    expect(result.max.x).toBeCloseTo(1, 3);
  });

  it('grows the solid over the covered volume when the operation is add', () => {
    const scene = operationEditScene('add');
    const result = stackResultBounds(scene.model);
    expect(result.min.x).toBeCloseTo(-1, 3);
    expect(result.max.x).toBeCloseTo(2, 3);
  });
});
