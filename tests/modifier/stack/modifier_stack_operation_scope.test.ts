import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';
import { modifierBevelRefreshScene } from '@/modifier/compile/modifier_bevel_scene_refresh.js';
import { modifierStackStatusRead } from '@/modifier/stack/evaluate/modifier_stack_status.js';
import type { ModifierStackVolumeOperation } from '@/modifier/stack/modifier_stack_types.js';
import { stackResultBounds } from './modifier_stack_fixture.js';
import {
  OPERATION_FIXTURE_BRUSH_SIZE,
  operationFixtureSet,
  operationFlatVolumeScene,
} from './modifier_stack_operation_fixture.js';

/**
 * Builds a world with two solids, each holding one additive box brush. The far
 * solid's root sits several brush sizes away along X, and the near solid's root
 * is offset too, so model and world space differ for both. A volume covers the
 * +X half of the near brush only, and its operation is stored after a first
 * refresh, the order an inspector edit produces.
 *
 * @param operation Volume operation.
 * @returns Both solids, the volume and the world.
 */
function operationTwoSolidScene(operation: ModifierStackVolumeOperation) {
  const size = OPERATION_FIXTURE_BRUSH_SIZE;
  const world = new THREE.Group();
  const near = new SolidModel('Near solid');
  const far = new SolidModel('Far solid');
  world.add(near.root, far.root);
  near.addBoxBrush(size, SolidOperation.Additive);
  far.addBoxBrush(size, SolidOperation.Additive);
  near.root.position.set(size * 3, 0, 0);
  far.root.position.set(size * 10, 0, 0);
  const volume = ModifierVolume.create({ modifiers: [] });
  volume.position.set(near.root.position.x + size / 2, 0, 0);
  volume.scale.set(size, size * 2, size * 2);
  world.add(volume);
  world.updateMatrixWorld(true);
  modifierBevelRefreshScene(world);
  operationFixtureSet(world, volume, operation);
  return { world, near, far, volume };
}

/**
 * Rebuilds every brush of a solid, as editing an unrelated brush of it does.
 *
 * @param model Solid model.
 */
function operationSolidRebuildAll(model: SolidModel): void {
  model.markBrushesDirty(model.getBrushes().map((brush) => brush.id));
  model.rebuild();
}

describe('modifier volume operation scope', () => {
  it('cuts at the volume position in world space when the solid root is moved', () => {
    const scene = operationTwoSolidScene('subtract');
    const result = stackResultBounds(scene.near);
    expect(result.min.x).toBeCloseTo(-OPERATION_FIXTURE_BRUSH_SIZE / 2, 3);
    expect(result.max.x).toBeCloseTo(0, 3);
  });

  it('cuts the world +X half when the solid root is mirrored on X', () => {
    const size = OPERATION_FIXTURE_BRUSH_SIZE;
    const world = new THREE.Group();
    const model = new SolidModel('Mirrored solid');
    world.add(model.root);
    model.addBoxBrush(size, SolidOperation.Additive);
    model.root.scale.x = -1;
    const volume = ModifierVolume.create({ modifiers: [] });
    volume.position.x = size / 2;
    volume.scale.set(size, size * 2, size * 2);
    world.add(volume);
    world.updateMatrixWorld(true);
    modifierBevelRefreshScene(world);
    operationFixtureSet(world, volume, 'subtract');
    const result = stackResultBounds(model).applyMatrix4(model.root.matrixWorld);
    expect(result.min.x).toBeCloseTo(-size / 2, 3);
    expect(result.max.x).toBeCloseTo(0, 3);
    expect(result.getSize(new THREE.Vector3()).y).toBeCloseTo(size, 3);
  });

  it('adds the box at the volume position in world space when the solid root is moved', () => {
    const scene = operationTwoSolidScene('add');
    const result = stackResultBounds(scene.near);
    const volumeWorld = new THREE.Box3().setFromObject(scene.volume);
    expect(result.max.x + scene.near.root.position.x).toBeCloseTo(volumeWorld.max.x, 3);
  });

  it('leaves a solid the volume does not touch whole, even after that solid rebuilds', () => {
    for (const operation of ['add', 'subtract', 'intersect'] as const) {
      const scene = operationTwoSolidScene(operation);
      const before = stackResultBounds(scene.far);
      operationSolidRebuildAll(scene.far);
      const after = stackResultBounds(scene.far);
      expect(after.isEmpty()).toBe(false);
      expect(after.min.distanceTo(before.min)).toBeCloseTo(0, 3);
      expect(after.max.distanceTo(before.max)).toBeCloseTo(0, 3);
      expect(after.getSize(new THREE.Vector3()).x).toBeCloseTo(OPERATION_FIXTURE_BRUSH_SIZE, 3);
    }
  });

  it('counts the box once, for the solid the volume captures', () => {
    const scene = operationTwoSolidScene('subtract');
    operationSolidRebuildAll(scene.far);
    expect(modifierStackStatusRead(scene.volume)?.derived).toBe(1);
  });

  it('restores the solid when a subtractive volume moves off it', () => {
    const scene = operationTwoSolidScene('subtract');
    const volumeWidth = new THREE.Box3().setFromObject(scene.volume).getSize(new THREE.Vector3()).x;
    scene.volume.position.x += volumeWidth + OPERATION_FIXTURE_BRUSH_SIZE;
    modifierBevelRefreshScene(scene.world);
    const result = stackResultBounds(scene.near);
    expect(result.getSize(new THREE.Vector3()).x).toBeCloseTo(OPERATION_FIXTURE_BRUSH_SIZE, 3);
    expect(modifierStackStatusRead(scene.volume)?.derived).toBe(0);
  });

  it('writes no box for a volume without thickness and still reports the brushes it captured', () => {
    const scene = operationFlatVolumeScene();
    const whole = stackResultBounds(scene.model);
    operationFixtureSet(scene.world, scene.volume, 'subtract');
    const status = modifierStackStatusRead(scene.volume);
    expect(scene.touchedBrushes).toBeGreaterThan(0);
    expect(status?.captured).toBe(scene.touchedBrushes);
    expect(status?.derived).toBe(0);
    const result = stackResultBounds(scene.model);
    expect(result.min.distanceTo(whole.min)).toBeCloseTo(0, 3);
    expect(result.max.distanceTo(whole.max)).toBeCloseTo(0, 3);
  });
});
