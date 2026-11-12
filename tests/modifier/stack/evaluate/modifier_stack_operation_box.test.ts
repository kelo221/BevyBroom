import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';
import { modifierStackVolumeBox } from '@/modifier/stack/evaluate/modifier_stack_frame.js';
import type { ModifierStackVolumeOperation } from '@/modifier/stack/modifier_stack_types.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { expectStackConvex, stackFixture, stackFixtureRequired } from '../modifier_stack_fixture.js';

/**
 * Stores a volume operation on a fixture volume.
 *
 * @param volume Modifier volume.
 * @param operation Volume operation to store.
 */
function volumeOperationStore(volume: THREE.Object3D, operation: ModifierStackVolumeOperation): void {
  ModifierVolume.write(volume, { ...ModifierVolume.read(volume), operation });
}

/**
 * Finds the operation box instance a volume appends to the compile list.
 *
 * @param instances Compile list.
 * @param volume Modifier volume that owns the box.
 * @returns Operation box instance, or undefined when none was appended.
 */
function operationBoxFind(
  instances: readonly SolidBrushInstance[],
  volume: THREE.Object3D,
): SolidBrushInstance | undefined {
  return instances.find((instance) => instance.id === `${volume.uuid}#operation`);
}

/**
 * Returns the bounds of a brush's vertices in model space.
 *
 * @param instance Compiled brush instance.
 * @returns Bounds of its vertices.
 */
function brushVertexBounds(instance: SolidBrushInstance): THREE.Box3 {
  return new THREE.Box3().setFromPoints(instance.brush.vertices);
}

describe('modifier stack operation box', () => {
  it('appends the volume box with the matching CSG operation for each boolean choice', () => {
    const expected: [ModifierStackVolumeOperation, SolidOperation][] = [
      ['add', SolidOperation.Additive],
      ['subtract', SolidOperation.Subtractive],
      ['intersect', SolidOperation.Intersecting],
    ];
    for (const [operation, solidOperation] of expected) {
      const fixture = stackFixture([]);
      volumeOperationStore(fixture.volume, operation);
      const box = stackFixtureRequired(operationBoxFind(fixture.compile().instances, fixture.volume), 'operation box');
      expect(box.operation).toBe(solidOperation);
    }
  });

  it('places the box in model space at the volume bounds, so it cuts where the volume is', () => {
    const fixture = stackFixture([]);
    const brushBounds = new THREE.Box3().setFromObject(fixture.model.root);
    const brushSize = brushBounds.getSize(new THREE.Vector3());
    fixture.volume.position.copy(brushBounds.max);
    fixture.volume.scale.set(brushSize.x * 2, brushSize.y, brushSize.z * 3);
    volumeOperationStore(fixture.volume, 'subtract');
    const box = stackFixtureRequired(operationBoxFind(fixture.compile().instances, fixture.volume), 'operation box');
    const expected = modifierStackVolumeBox(fixture.volume).translate(fixture.volume.position);
    const actual = brushVertexBounds(box);
    expect(actual.min.distanceTo(expected.min)).toBeLessThan(1e-5);
    expect(actual.max.distanceTo(expected.max)).toBeLessThan(1e-5);
  });

  it('keeps the box convex so the solid can cut with it', () => {
    const fixture = stackFixture([]);
    fixture.volume.rotation.set(Math.PI / 7, Math.PI / 4, Math.PI / 9);
    volumeOperationStore(fixture.volume, 'subtract');
    const box = stackFixtureRequired(operationBoxFind(fixture.compile().instances, fixture.volume), 'operation box');
    expectStackConvex(box);
  });

  it('appends no box when the volume has no boolean operation', () => {
    const fixture = stackFixture(['linear']);
    expect(operationBoxFind(fixture.compile().instances, fixture.volume)).toBeUndefined();
  });

  it('appends no box when the volume captures no brush of the solid', () => {
    const fixture = stackFixture([], 1);
    const brushBounds = new THREE.Box3().setFromObject(fixture.model.root);
    fixture.volume.position.x = brushBounds.max.x + brushBounds.getSize(new THREE.Vector3()).x * 2;
    volumeOperationStore(fixture.volume, 'add');
    expect(operationBoxFind(fixture.compile().instances, fixture.volume)).toBeUndefined();
  });

  it('appends no box for a volume whose box is empty', () => {
    const fixture = stackFixture([]);
    fixture.volume.scale.set(1, 0, 1);
    volumeOperationStore(fixture.volume, 'subtract');
    expect(operationBoxFind(fixture.compile().instances, fixture.volume)).toBeUndefined();
  });
});
