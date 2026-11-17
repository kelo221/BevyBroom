import * as THREE from 'three';

/** Edge length of the clickable box of point entities in meters. */
export const ENTITY_POINT_BOX_SIZE = 0.4;

/** Size and placement of a point entity box in the entity's own space. */
export interface EntityPointBoxShape {
  /** Edge lengths along x, y and z in meters. */
  readonly size: readonly [number, number, number];
  /** Center of the box relative to the entity origin in meters. */
  readonly offset: readonly [number, number, number];
}

/** Face and edge geometry of one box shape. */
export interface EntityPointBoxGeometryPair {
  readonly faces: THREE.BufferGeometry;
  readonly edges: THREE.BufferGeometry;
}

/** The standard small box centered on the entity origin. */
export const ENTITY_POINT_BOX_SHAPE_DEFAULT: EntityPointBoxShape = {
  size: [ENTITY_POINT_BOX_SIZE, ENTITY_POINT_BOX_SIZE, ENTITY_POINT_BOX_SIZE],
  offset: [0, 0, 0],
};

/**
 * Builds and shares the geometry of point entity boxes, one face and edge pair
 * per distinct shape. Shared geometry is never disposed.
 */
export class EntityVisualPointBoxGeometry {
  private static readonly pairsByShapeKey = new Map<string, EntityPointBoxGeometryPair>();

  /**
   * Returns the shared geometry pair of a shape, building it on first use.
   *
   * @param shape Box shape.
   * @returns Face and edge geometry of the shape.
   */
  static pairOf(shape: EntityPointBoxShape): EntityPointBoxGeometryPair {
    const shapeKey = EntityVisualPointBoxGeometry.shapeKeyOf(shape);
    const existing = EntityVisualPointBoxGeometry.pairsByShapeKey.get(shapeKey);
    if (existing !== undefined) {
      return existing;
    }
    const created = EntityVisualPointBoxGeometry.pairBuild(shape);
    EntityVisualPointBoxGeometry.pairsByShapeKey.set(shapeKey, created);
    return created;
  }

  /**
   * Returns a text key that is equal for equal shapes.
   *
   * @param shape Box shape.
   * @returns Key text.
   */
  static shapeKeyOf(shape: EntityPointBoxShape): string {
    return `${shape.size.join(',')}@${shape.offset.join(',')}`;
  }

  /**
   * Builds the face and edge geometry of a shape.
   *
   * @param shape Box shape.
   * @returns New geometry pair.
   */
  private static pairBuild(shape: EntityPointBoxShape): EntityPointBoxGeometryPair {
    const [width, height, depth] = shape.size;
    const [offsetX, offsetY, offsetZ] = shape.offset;
    const faces = new THREE.BoxGeometry(width, height, depth);
    faces.translate(offsetX, offsetY, offsetZ);
    return { faces, edges: new THREE.EdgesGeometry(faces) };
  }
}
