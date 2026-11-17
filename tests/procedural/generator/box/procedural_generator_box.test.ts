import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  PROCEDURAL_GENERATOR_BOX_CORNER_A,
  PROCEDURAL_GENERATOR_BOX_CORNER_B,
  PROCEDURAL_GENERATOR_BOX_MIN_SIZE,
  PROCEDURAL_GENERATOR_BOX_SLOT_SURFACE,
  ProceduralGeneratorBox,
} from '@/procedural/generator/box/procedural_generator_box.js';
import { ProceduralParametersRead } from '@/procedural/generator/procedural_parameters_read.js';
import { ProceduralGeometryBuilder } from '@/procedural/build/procedural_geometry_builder.js';
import { DEFAULT_CHECKER_TEXTURE_ID } from '@/texture/library/texture_id.js';

const generator = new ProceduralGeneratorBox();

/**
 * Returns box parameters with the given corners.
 *
 * @param cornerA First corner.
 * @param cornerB Opposite corner.
 * @returns Sanitized parameters.
 */
function boxParameters(
  cornerA: THREE.Vector3,
  cornerB: THREE.Vector3,
): ReturnType<typeof generator.parametersSanitize> {
  return generator.parametersSanitize({
    [PROCEDURAL_GENERATOR_BOX_CORNER_A]: cornerA.toArray(),
    [PROCEDURAL_GENERATOR_BOX_CORNER_B]: cornerB.toArray(),
  });
}

/** The two-corner box proves the generator framework. */
describe('ProceduralGeneratorBox', () => {
  it('defaults to a box with a volume and offers its six faces as handles instead of corner points', () => {
    const parameters = generator.parametersCreateDefault();
    const cornerA = ProceduralParametersRead.vector3(parameters, PROCEDURAL_GENERATOR_BOX_CORNER_A);
    const cornerB = ProceduralParametersRead.vector3(parameters, PROCEDURAL_GENERATOR_BOX_CORNER_B);
    const size = cornerB.clone().sub(cornerA);
    expect(Math.min(Math.abs(size.x), Math.abs(size.y), Math.abs(size.z))).toBeGreaterThan(0);
    expect(generator.handlePointPaths()).toEqual([]);
    const faces = generator.handleFaces().map((face) => `${face.side}_${face.axis}`);
    expect(new Set(faces)).toEqual(new Set(['min_x', 'max_x', 'min_y', 'max_y', 'min_z', 'max_z']));
  });

  it('builds one convex part spanning the corners in either order', () => {
    const cornerA = new THREE.Vector3(2, 3, -1);
    const cornerB = new THREE.Vector3(-1, 0.5, 4);
    const parts = generator.partsBuild(boxParameters(cornerA, cornerB));
    expect(parts).toHaveLength(1);
    const geometry = ProceduralGeometryBuilder.create(parts);
    geometry.computeBoundingBox();
    const expected = new THREE.Box3().setFromPoints([cornerA, cornerB]);
    expect(geometry.boundingBox?.equals(expected)).toBe(true);
    expect(parts[0]?.materialSlot).toBe(PROCEDURAL_GENERATOR_BOX_SLOT_SURFACE);
  });

  it('reports the size it builds as a derived value', () => {
    const cornerA = new THREE.Vector3(1, 0, 1);
    const cornerB = new THREE.Vector3(-2, 2.5, 3);
    const derived = generator.derivedValues(boxParameters(cornerA, cornerB));
    const size = new THREE.Box3().setFromPoints([cornerA, cornerB]).getSize(new THREE.Vector3());
    expect(derived['size']).toEqual(size.toArray());
  });

  it('pushes a flat corner apart so the box keeps a volume', () => {
    const cornerA = new THREE.Vector3(1, 2, 3);
    const parameters = boxParameters(cornerA, new THREE.Vector3(4, cornerA.y, 5));
    const cornerB = ProceduralParametersRead.vector3(parameters, PROCEDURAL_GENERATOR_BOX_CORNER_B);
    expect(cornerB.y - cornerA.y).toBeCloseTo(PROCEDURAL_GENERATOR_BOX_MIN_SIZE, 9);
    expect(cornerB.x).toBe(4);
  });

  it('builds the same parts for the same parameters', () => {
    const parameters = boxParameters(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 2, 3));
    expect(JSON.stringify(generator.partsBuild(parameters))).toBe(JSON.stringify(generator.partsBuild(parameters)));
  });

  it('gives every material slot the checker texture until one is chosen', () => {
    expect(generator.materialsSanitize({})).toEqual({
      [PROCEDURAL_GENERATOR_BOX_SLOT_SURFACE]: DEFAULT_CHECKER_TEXTURE_ID,
    });
    expect(generator.materialsSanitize({ [PROCEDURAL_GENERATOR_BOX_SLOT_SURFACE]: 'stone/wall', other: 'x' })).toEqual({
      [PROCEDURAL_GENERATOR_BOX_SLOT_SURFACE]: 'stone/wall',
    });
  });

  it('drops parameters that are not fields', () => {
    const parameters = generator.parametersSanitize({ stray: 5 });
    expect(Object.keys(parameters).sort()).toEqual(
      generator
        .fields()
        .map((field) => field.path)
        .sort(),
    );
  });
});
