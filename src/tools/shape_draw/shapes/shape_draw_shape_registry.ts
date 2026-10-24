import { RegistryExtensible } from '@/utils/registry/registry_extensible.js';
import { ShapeDrawShape } from './shape_draw_shape.js';
import { ShapeDrawShapeCuboid } from './shape_draw_shape_cuboid.js';
import { ShapeDrawShapeStairs } from './shape_draw_shape_stairs.js';
import { ShapeDrawShapeArch } from './shape_draw_shape_arch.js';
import { ShapeDrawShapeCylinder } from './shape_draw_shape_cylinder.js';
import { ShapeDrawShapeCone } from './shape_draw_shape_cone.js';
import { ShapeDrawShapeSpheroidUv } from './shape_draw_shape_spheroid_uv.js';
import { ShapeDrawShapeSpheroidIcosahedron } from './shape_draw_shape_spheroid_icosahedron.js';

/** Ordered catalogue of every shape the draw tool can create. */
export const SHAPE_DRAW_SHAPE_REGISTRY = new RegistryExtensible<ShapeDrawShape>(() => [
  new ShapeDrawShapeCuboid(),
  new ShapeDrawShapeStairs(),
  new ShapeDrawShapeArch(),
  new ShapeDrawShapeCylinder(),
  new ShapeDrawShapeCone(),
  new ShapeDrawShapeSpheroidUv(),
  new ShapeDrawShapeSpheroidIcosahedron(),
]);

/** Shape id drawn before the user picks one. */
export const SHAPE_DRAW_DEFAULT_SHAPE_ID = 'cuboid';

/**
 * Lists every registered shape in catalogue order.
 *
 * @returns Shared read-only list; do not keep it across registrations.
 */
export function shapeDrawShapesList(): readonly ShapeDrawShape[] {
  return SHAPE_DRAW_SHAPE_REGISTRY.list();
}

/**
 * Finds a shape by id.
 *
 * @param shapeId Shape identifier.
 * @returns Shape, or the cuboid when the id matches nothing.
 */
export function shapeDrawShapeFind(shapeId: string): ShapeDrawShape {
  const found = shapeDrawShapesList().find((shape) => shape.id === shapeId);
  if (found) {
    return found;
  }
  return shapeDrawShapeFind(SHAPE_DRAW_DEFAULT_SHAPE_ID);
}
