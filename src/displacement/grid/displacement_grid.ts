import * as THREE from 'three';
import type { SolidBrush } from '@/solid/brush/solid_brush.js';
import type { DisplacementPower } from '@/displacement/model/displacement_types.js';
import { displacementRowLength } from '@/displacement/model/displacement_face_surface.js';

/** Number of corners a face needs to carry a displacement. */
const DISPLACEMENT_GRID_CORNER_COUNT = 4;

/**
 * Bilinear (2^power + 1)^2 vertex grid spanning one four-sided brush face in
 * brush-local space. Columns run from the first face corner to the second, rows
 * from the first corner to the fourth.
 */
export class DisplacementGrid {
  readonly power: DisplacementPower;
  readonly rowLength: number;
  private readonly corners: readonly THREE.Vector3[];

  /**
   * Creates a grid over four face corners.
   *
   * @param corners Face corners in winding order.
   * @param power Subdivision power.
   */
  private constructor(corners: readonly THREE.Vector3[], power: DisplacementPower) {
    this.corners = corners;
    this.power = power;
    this.rowLength = displacementRowLength(power);
  }

  /**
   * Returns why a brush face cannot carry a displacement.
   *
   * @param brush Brush geometry.
   * @param surfaceIndex Face index.
   * @returns Failure message, or null when the face can be displaced.
   */
  static faceFailureRead(brush: SolidBrush, surfaceIndex: number): string | null {
    const face = brush.faces[surfaceIndex];
    if (!face) {
      return `Face ${surfaceIndex} does not exist on the brush`;
    }
    if (face.edgeCount !== DISPLACEMENT_GRID_CORNER_COUNT) {
      return `Displacements need a four-sided face; face ${surfaceIndex} has ${face.edgeCount} sides`;
    }
    return null;
  }

  /**
   * Builds the grid of a four-sided brush face.
   *
   * @param brush Brush geometry.
   * @param surfaceIndex Face index.
   * @param power Subdivision power.
   * @returns Grid, or null when the face is not four-sided.
   */
  static fromBrushFace(brush: SolidBrush, surfaceIndex: number, power: DisplacementPower): DisplacementGrid | null {
    const face = brush.faces[surfaceIndex];
    if (!face || DisplacementGrid.faceFailureRead(brush, surfaceIndex) !== null) {
      return null;
    }
    return new DisplacementGrid(brush.getFaceVertices(face), power);
  }

  /**
   * Returns the vertex count of the grid.
   *
   * @returns RowLength squared.
   */
  vertexCount(): number {
    return this.rowLength * this.rowLength;
  }

  /**
   * Writes the flat brush-local position of one grid vertex.
   *
   * @param row Row index from the first corner towards the fourth.
   * @param column Column index from the first corner towards the second.
   * @param target Vector receiving the position.
   * @returns The target vector.
   */
  basePointWrite(row: number, column: number, target: THREE.Vector3): THREE.Vector3 {
    const steps = this.rowLength - 1;
    const alongColumn = column / steps;
    const alongRow = row / steps;
    target.set(0, 0, 0);
    this.cornerWeightedAdd(0, (1 - alongColumn) * (1 - alongRow), target);
    this.cornerWeightedAdd(1, alongColumn * (1 - alongRow), target);
    this.cornerWeightedAdd(2, alongColumn * alongRow, target);
    this.cornerWeightedAdd(3, (1 - alongColumn) * alongRow, target);
    return target;
  }

  /**
   * Lists the flat brush-local positions of every vertex, row-major.
   *
   * @returns New position list.
   */
  basePointsLocal(): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    for (let row = 0; row < this.rowLength; row++) {
      for (let column = 0; column < this.rowLength; column++) {
        points.push(this.basePointWrite(row, column, new THREE.Vector3()));
      }
    }
    return points;
  }

  /**
   * Adds one weighted corner to an accumulating position.
   *
   * @param cornerIndex Corner index 0 to 3.
   * @param weight Bilinear weight.
   * @param target Accumulator.
   */
  private cornerWeightedAdd(cornerIndex: number, weight: number, target: THREE.Vector3): void {
    const corner = this.corners[cornerIndex];
    if (corner) {
      target.addScaledVector(corner, weight);
    }
  }
}
