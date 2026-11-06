import * as THREE from 'three';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import type { DisplacementFaceSurface } from '@/displacement/model/displacement_types.js';
import { DisplacementGrid } from './displacement_grid.js';

/**
 * Flat grid of one displaced brush face placed in a target space (solid model
 * space or world space), with the face normal in that space. Displaced vertex
 * positions are the flat positions pushed along the normal by the elevation
 * plus each scaled offset.
 */
export class DisplacementSurfacePlacement {
  readonly rowLength: number;
  readonly baseLocalPositions: readonly THREE.Vector3[];
  readonly basePositions: readonly THREE.Vector3[];
  readonly normal: THREE.Vector3;

  /**
   * Creates a placement from a grid and a brush-local to target matrix.
   *
   * @param grid Brush-local grid.
   * @param localNormal Brush-local face normal.
   * @param spaceMatrix Brush-local to target space matrix.
   */
  private constructor(grid: DisplacementGrid, localNormal: THREE.Vector3, spaceMatrix: THREE.Matrix4) {
    this.rowLength = grid.rowLength;
    this.baseLocalPositions = grid.basePointsLocal();
    this.basePositions = this.baseLocalPositions.map((point) => point.clone().applyMatrix4(spaceMatrix));
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(spaceMatrix);
    this.normal = localNormal.clone().applyMatrix3(normalMatrix).normalize();
  }

  /**
   * Places a displaced brush face in solid model space.
   *
   * @param instance Brush owning the face.
   * @param surfaceIndex Face index.
   * @param displacement Displacement whose power sizes the grid.
   * @returns Placement, or null when the face cannot carry a displacement.
   */
  static forModelSpace(
    instance: SolidBrushInstance,
    surfaceIndex: number,
    displacement: Readonly<DisplacementFaceSurface>,
  ): DisplacementSurfacePlacement | null {
    return DisplacementSurfacePlacement.forSpace(instance, surfaceIndex, displacement, instance.getModelSpaceMatrix());
  }

  /**
   * Places a displaced brush face in world space.
   *
   * @param instance Brush owning the face.
   * @param surfaceIndex Face index.
   * @param displacement Displacement whose power sizes the grid.
   * @param solidRoot Solid model root the brush belongs to.
   * @returns Placement, or null when the face cannot carry a displacement.
   */
  static forWorldSpace(
    instance: SolidBrushInstance,
    surfaceIndex: number,
    displacement: Readonly<DisplacementFaceSurface>,
    solidRoot: THREE.Object3D,
  ): DisplacementSurfacePlacement | null {
    solidRoot.updateWorldMatrix(true, false);
    const worldMatrix = solidRoot.matrixWorld.clone().multiply(instance.getModelSpaceMatrix());
    return DisplacementSurfacePlacement.forSpace(instance, surfaceIndex, displacement, worldMatrix);
  }

  /**
   * Places a displaced brush face through an explicit brush-local matrix.
   *
   * @param instance Brush owning the face.
   * @param surfaceIndex Face index.
   * @param displacement Displacement whose power sizes the grid.
   * @param spaceMatrix Brush-local to target space matrix.
   * @returns Placement, or null when the face cannot carry a displacement.
   */
  private static forSpace(
    instance: SolidBrushInstance,
    surfaceIndex: number,
    displacement: Readonly<DisplacementFaceSurface>,
    spaceMatrix: THREE.Matrix4,
  ): DisplacementSurfacePlacement | null {
    const grid = DisplacementGrid.fromBrushFace(instance.brush, surfaceIndex, displacement.power);
    if (!grid) {
      return null;
    }
    return new DisplacementSurfacePlacement(grid, instance.faceNormalLocal(surfaceIndex), spaceMatrix);
  }

  /**
   * Returns the distance of one vertex above its flat position.
   *
   * @param displacement Displacement data.
   * @param vertexIndex Row-major vertex index.
   * @returns Signed distance along the normal.
   */
  static heightRead(displacement: Readonly<DisplacementFaceSurface>, vertexIndex: number): number {
    return displacement.elevation + (displacement.offsets[vertexIndex] ?? 0) * displacement.scale;
  }

  /**
   * Writes the displaced position of one vertex.
   *
   * @param displacement Displacement data.
   * @param vertexIndex Row-major vertex index.
   * @param target Vector receiving the position.
   * @returns The target vector.
   */
  displacedPositionWrite(
    displacement: Readonly<DisplacementFaceSurface>,
    vertexIndex: number,
    target: THREE.Vector3,
  ): THREE.Vector3 {
    const base = this.basePositions[vertexIndex];
    if (!base) {
      return target.set(0, 0, 0);
    }
    const height = DisplacementSurfacePlacement.heightRead(displacement, vertexIndex);
    return target.copy(base).addScaledVector(this.normal, height);
  }

  /**
   * Lists the displaced positions of every vertex, row-major.
   *
   * @param displacement Displacement data.
   * @returns New position list.
   */
  displacedPositions(displacement: Readonly<DisplacementFaceSurface>): THREE.Vector3[] {
    return this.basePositions.map((_base, vertexIndex) =>
      this.displacedPositionWrite(displacement, vertexIndex, new THREE.Vector3()),
    );
  }
}
