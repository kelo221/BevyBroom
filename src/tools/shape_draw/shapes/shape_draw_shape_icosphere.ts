import * as THREE from 'three';

/** Golden ratio of the base icosahedron construction. */
const ICOSPHERE_GOLDEN_RATIO = (1 + Math.sqrt(5)) * 0.5;

/** One triangle of a subdividing icosphere. */
interface ShapeDrawIcosphereFace {
  /** First corner point index. */
  a: number;
  /** Second corner point index. */
  b: number;
  /** Third corner point index. */
  c: number;
}

/**
 * Builds the unique vertex cloud of a subdivided icosahedron on the unit
 * sphere.
 */
export class ShapeDrawIcospherePoints {
  /**
   * Lists every vertex of an icosahedron subdivided to a level.
   *
   * @param subdivision Subdivision level (zero keeps the twelve base points).
   * @returns Unique points on the unit sphere.
   */
  static create(subdivision: number): THREE.Vector3[] {
    const points = this.basePointsCreate();
    let faces = this.baseFaces();
    for (let level = 0; level < subdivision; level += 1) {
      faces = this.facesSubdivide(points, faces);
    }
    return points;
  }

  /**
   * Lists the twelve normalized corners of the base icosahedron.
   *
   * @returns Base points.
   */
  private static basePointsCreate(): THREE.Vector3[] {
    const t = ICOSPHERE_GOLDEN_RATIO;
    const corners: Array<[number, number, number]> = [
      [-1, t, 0],
      [1, t, 0],
      [-1, -t, 0],
      [1, -t, 0],
      [0, -1, t],
      [0, 1, t],
      [0, -1, -t],
      [0, 1, -t],
      [t, 0, -1],
      [t, 0, 1],
      [-t, 0, -1],
      [-t, 0, 1],
    ];
    return corners.map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());
  }

  /**
   * Lists the twenty outward faces of the base icosahedron.
   *
   * @returns Base faces.
   */
  private static baseFaces(): ShapeDrawIcosphereFace[] {
    return [...this.capFacesCreate(), ...this.ringFacesCreate()].map(([a, b, c]) => ({ a, b, c }));
  }

  /**
   * Lists the ten faces around the top and bottom corners.
   *
   * @returns Corner face triples.
   */
  private static capFacesCreate(): Array<[number, number, number]> {
    return [
      [0, 11, 5],
      [0, 5, 1],
      [0, 1, 7],
      [0, 7, 10],
      [0, 10, 11],
      [3, 9, 4],
      [3, 4, 2],
      [3, 2, 6],
      [3, 6, 8],
      [3, 8, 9],
    ];
  }

  /**
   * Lists the ten faces of the middle band.
   *
   * @returns Band face triples.
   */
  private static ringFacesCreate(): Array<[number, number, number]> {
    return [
      [1, 5, 9],
      [5, 11, 4],
      [11, 10, 2],
      [10, 7, 6],
      [7, 1, 8],
      [4, 9, 5],
      [2, 4, 11],
      [6, 2, 10],
      [8, 6, 7],
      [9, 8, 1],
    ];
  }

  /**
   * Splits every face into four by edge midpoints snapped onto the sphere.
   *
   * @param points Vertex cloud new midpoints are appended to.
   * @param faces Faces of the current level.
   * @returns Faces of the next level.
   */
  private static facesSubdivide(points: THREE.Vector3[], faces: ShapeDrawIcosphereFace[]): ShapeDrawIcosphereFace[] {
    const midpointIndexes = new Map<string, number>();
    const nextFaces: ShapeDrawIcosphereFace[] = [];
    for (const face of faces) {
      const ab = this.midpointIndexEnsure(points, midpointIndexes, face.a, face.b);
      const bc = this.midpointIndexEnsure(points, midpointIndexes, face.a, face.c);
      const ca = this.midpointIndexEnsure(points, midpointIndexes, face.b, face.c);
      nextFaces.push({ a: face.a, b: ab, c: ca });
      nextFaces.push({ a: face.b, b: bc, c: ab });
      nextFaces.push({ a: face.c, b: ca, c: bc });
      nextFaces.push({ a: ab, b: bc, c: ca });
    }
    return nextFaces;
  }

  /**
   * Returns the index of an edge midpoint, creating it on first use.
   *
   * @param points Vertex cloud the midpoint joins.
   * @param midpointIndexes Cache of existing edge midpoints keyed by endpoint
   *   pair.
   * @param firstIndex First endpoint index.
   * @param secondIndex Second endpoint index.
   * @returns Midpoint vertex index.
   */
  private static midpointIndexEnsure(
    points: THREE.Vector3[],
    midpointIndexes: Map<string, number>,
    firstIndex: number,
    secondIndex: number,
  ): number {
    const key = firstIndex < secondIndex ? `${firstIndex}_${secondIndex}` : `${secondIndex}_${firstIndex}`;
    const cached = midpointIndexes.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const firstPoint = points[firstIndex];
    const secondPoint = points[secondIndex];
    if (!firstPoint || !secondPoint) {
      throw new Error('Icosphere edge endpoints must exist');
    }
    const midpoint = firstPoint.clone().add(secondPoint).normalize();
    points.push(midpoint);
    midpointIndexes.set(key, points.length - 1);
    return points.length - 1;
  }
}
