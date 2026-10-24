import { describe, expect, it } from 'vitest';
import { RegistryExtensible } from '@/utils/registry/registry_extensible.js';
import { ShapeDrawShapeCone } from '@/tools/shape_draw/shapes/shape_draw_shape_cone.js';
import {
  SHAPE_DRAW_DEFAULT_SHAPE_ID,
  shapeDrawShapeFind,
  shapeDrawShapesList,
} from '@/tools/shape_draw/shapes/shape_draw_shape_registry.js';

/** Proves the shape catalogue lists every built-in shape and stays extensible. */
describe('shape_draw_shape_registry', () => {
  const expectedIds = ['cuboid', 'stairs', 'arch', 'cylinder', 'cone', 'spheroid_uv', 'spheroid_ico'];

  it('lists every built-in shape in catalogue order', () => {
    expect(shapeDrawShapesList().map((shape) => shape.id)).toEqual(expectedIds);
  });

  it('gives every shape a label and a registered icon', () => {
    for (const shape of shapeDrawShapesList()) {
      expect(shape.label.length).toBeGreaterThan(0);
      expect(shape.icon.length).toBeGreaterThan(0);
    }
  });

  it('finds shapes by id and falls back to the default shape', () => {
    expect(shapeDrawShapeFind('stairs').id).toBe('stairs');
    expect(shapeDrawShapeFind('not_a_shape').id).toBe(SHAPE_DRAW_DEFAULT_SHAPE_ID);
  });

  it('accepts shapes registered while the editor runs', () => {
    const registry = new RegistryExtensible(shapeDrawShapesList);
    const builtinCount = registry.list().length;
    const extra = new ShapeDrawShapeCone();
    registry.register(extra);
    expect(registry.list()).toHaveLength(builtinCount + 1);
  });
});
