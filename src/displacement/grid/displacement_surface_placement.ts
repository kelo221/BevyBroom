import * as THREE from 'three';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import type { DisplacementFaceSurface } from '@/displacement/model/displacement_types.js';
import { displacementSeamOffsetRead } from '@/displacement/model/displacement_seam_offsets.js';
import { DisplacementGrid } from './displacement_grid.js';

/**
 * Flat grid of one displaced brush face placed in a target space (solid model
 * space or world space), with the face normal in that space. Displaced vertex
 * positions are the flat positions pushed along the normal by the elevation
 * plus each scaled offset, then moved by each seam offset through the face
 * frame.
 */
export class DisplacementSurfacePlacement {
  private static readonly scratchSeamOffset = new THREE.Vector3();
  readonly rowLength: number;
  readonly baseLocalPositions: readonly THREE.Vector3[];
  readonly basePositions: readonly THREE.Vector3[];
  readonly normal: THREE.Vector3;
  private readonly seamFrame: THREE.Matrix3;
  private readonly seamFrameInverse: THREE.Matrix3;

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
    this.seamFrame = DisplacementSurfacePlacement.seamFrameBuild(grid, spaceMatrix, this.normal);
    this.seamFrameInverse = this.seamFrame.clone().invert();
  }

  /**
   * Builds the target-space face frame seam offsets are stored in: the edge
   * from the first corner to the second, the edge from the first corner to the
   * fourth, and the unit face normal, as matrix columns.
   *
   * @param grid Brush-local grid.
   * @param spaceMatrix Brush-local to target space matrix.
   * @param normal Unit face normal in target space.
   * @returns Frame matrix mapping face-frame seam offsets to target space.
   */
  private static seamFrameBuild(
    grid: DisplacementGrid,
    spaceMatrix: THREE.Matrix4,
    normal: THREE.Vector3,
  ): THREE.Matrix3 {
    const linearPart = new THREE.Matrix3().setFromMatrix4(spaceMatrix);
    const firstEdge = grid.cornerEdgeFromFirstWrite(1, new THREE.Vector3()).applyMatrix3(linearPart);
    const fourthEdge = grid.cornerEdgeFromFirstWrite(3, new THREE.Vector3()).applyMatrix3(linearPart);
    return new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeBasis(firstEdge, fourthEdge, normal));
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
   * Returns the distance of one vertex above its flat position from the
   * elevation and its scaled offset, without its seam offset.
   *
   * @param displacement Displacement data.
   * @param vertexIndex Row-major vertex index.
   * @returns Signed distance along the normal.
   */
  static heightRead(displacement: Readonly<DisplacementFaceSurface>, vertexIndex: number): number {
    return displacement.elevation + (displacement.offsets[vertexIndex] ?? 0) * displacement.scale;
  }

  /**
   * Writes the position of one vertex moved along the normal by its height,
   * without its seam offset.
   *
   * @param displacement Displacement data.
   * @param vertexIndex Row-major vertex index.
   * @param target Vector receiving the position.
   * @returns The target vector.
   */
  heightPositionWrite(
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
   * Writes the displaced position of one vertex, seam offset included.
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
    const seamOffset = DisplacementSurfacePlacement.scratchSeamOffset;
    this.heightPositionWrite(displacement, vertexIndex, target);
    if (!displacement.seamOffsets) {
      return target;
    }
    return target.add(this.seamOffsetToSpaceWrite(displacementSeamOffsetRead(displacement, vertexIndex, seamOffset)));
  }

  /**
   * Converts a face-frame seam offset into a target-space vector in place.
   *
   * @param seamOffset Face-frame seam offset, replaced by the target-space
   *   vector.
   * @returns The converted vector.
   */
  seamOffsetToSpaceWrite(seamOffset: THREE.Vector3): THREE.Vector3 {
    return seamOffset.applyMatrix3(this.seamFrame);
  }

  /**
   * Converts a target-space vector into a face-frame seam offset in place.
   *
   * @param spaceVector Target-space vector, replaced by the face-frame seam
   *   offset; zero when the face frame is degenerate.
   * @returns The converted seam offset.
   */
  seamOffsetFromSpaceWrite(spaceVector: THREE.Vector3): THREE.Vector3 {
    return spaceVector.applyMatrix3(this.seamFrameInverse);
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
