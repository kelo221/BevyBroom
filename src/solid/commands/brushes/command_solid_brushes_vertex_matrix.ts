import * as THREE from 'three';
import { SolidBrush } from '@/solid/brush/solid_brush.js';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidPlane } from '@/solid/brush/solid_plane.js';
import { solidHullBrushFromPoints } from '@/solid/algorithm/surface/solid_hull_brush.js';
import {
  brushVertexSurfaceTransform,
  brushVertexSurfacesTransformAll,
} from '@/transform/vertex/brush_vertex_surface_transform.js';
import { deserializeFaceSurface, type FaceSurfaceDescription } from '@/texture/uv_matrix/face_surface_description.js';
import {
  CommandSolidBrushesGeometryEdit,
  type SolidBrushGeometryEditRecord,
} from './command_solid_brushes_geometry_edit.js';

/** One brush and the world-space matrix applied to its vertices. */
export interface SolidBrushVertexMatrixEntry {
  /** Owning solid model. */
  model: SolidModel;
  /** Brush instance id. */
  brushId: string;
  /** World-space affine matrix applied to the brush vertices. */
  matrix: THREE.Matrix4;
  /** True when UV rows follow the vertices so textures stay put. */
  lockTextures: boolean;
}

/** Pre-edit surfaces materialized from an undo record. */
interface VertexMatrixPreviousSurfaces {
  /** Default surface before the edit. */
  defaultSurface: FaceSurfaceDescription;
  /** Per-face surfaces before the edit. */
  faceSurfaces: (FaceSurfaceDescription | undefined)[];
}

/**
 * Undoable command that applies a world-space affine matrix to the vertices of
 * several solid brushes at once. Orientation-flipping matrices (mirrors)
 * rebuild the convex topology so planes keep pointing outward. Brushes whose
 * result would be invalid are skipped and reported through the edit result.
 */
export class CommandSolidBrushesVertexMatrix extends CommandSolidBrushesGeometryEdit {
  private readonly entries: SolidBrushVertexMatrixEntry[];

  /**
   * Creates a vertex-matrix command.
   *
   * @param entries Brushes with their world-space matrices.
   */
  constructor(entries: readonly SolidBrushVertexMatrixEntry[]) {
    super();
    this.entries = entries.slice();
  }

  /** Applies every entry's matrix to its brush. */
  protected targetsEdit(): void {
    for (const entry of this.entries) {
      this.entryApply(entry);
    }
  }

  /**
   * Applies one entry's matrix to its brush.
   *
   * @param entry Brush with world-space matrix.
   */
  private entryApply(entry: SolidBrushVertexMatrixEntry): void {
    const instance = entry.model.findBrush(entry.brushId);
    if (!instance) {
      return;
    }
    const localMatrix = brushLocalMatrixCompose(instance, entry.matrix);
    const mirrored = localMatrix.determinant() < 0;
    const candidate = vertexMatrixCandidateBuild(instance.brush, localMatrix, mirrored);
    this.brushEditApply(entry.model, instance, candidate, (record) => {
      if (entry.lockTextures) {
        vertexMatrixSurfacesTransform(instance, localMatrix, mirrored, record);
      }
    });
  }
}

/**
 * Builds one command entry per brush that belongs to a solid model.
 *
 * @param brushes Brush instances to transform.
 * @param matrix World-space matrix, cloned into each entry.
 * @param lockTextures True when UV rows follow the vertices.
 * @returns Command entries in brush order.
 */
export function solidBrushVertexMatrixEntriesBuild(
  brushes: readonly SolidBrushInstance[],
  matrix: THREE.Matrix4,
  lockTextures: boolean,
): SolidBrushVertexMatrixEntry[] {
  return brushes.flatMap((brush) => {
    const model = brush.mesh ? SolidModel.fromObject(brush.mesh) : null;
    return model ? [{ model, brushId: brush.id, matrix: matrix.clone(), lockTextures }] : [];
  });
}

/**
 * Composes the brush-local matrix for a world-space matrix.
 *
 * @param instance Brush instance with a scene pose.
 * @param worldMatrix World-space affine matrix.
 * @returns Local' = world⁻¹ · matrix · world.
 */
export function brushLocalMatrixCompose(instance: SolidBrushInstance, worldMatrix: THREE.Matrix4): THREE.Matrix4 {
  if (instance.mesh) {
    instance.mesh.updateWorldMatrix(true, false);
    const world = instance.mesh.matrixWorld;
    return world.clone().invert().multiply(worldMatrix).multiply(world);
  }
  const local = instance.getLocalMatrix();
  return local.clone().invert().multiply(worldMatrix).multiply(local);
}

/**
 * Builds the transformed brush, rebuilding topology for mirrors.
 *
 * @param brush Source brush.
 * @param localMatrix Brush-local affine matrix.
 * @param mirrored True when the matrix flips orientation.
 * @returns Candidate brush, or null when a mirror hull cannot close.
 */
function vertexMatrixCandidateBuild(
  brush: SolidBrush,
  localMatrix: THREE.Matrix4,
  mirrored: boolean,
): SolidBrush | null {
  if (!mirrored) {
    const candidate = brush.clone();
    candidate.transformVertices(localMatrix);
    return candidate;
  }
  const points = brush.vertices.map((vertex) => vertex.clone().applyMatrix4(localMatrix));
  return solidHullBrushFromPoints(points);
}

/**
 * Updates face surfaces after the vertices moved.
 *
 * @param instance Brush holding the new geometry.
 * @param localMatrix Brush-local matrix that moved the vertices.
 * @param mirrored True when the geometry was rebuilt from a mirrored hull.
 * @param record Undo record holding the previous surfaces.
 */
function vertexMatrixSurfacesTransform(
  instance: SolidBrushInstance,
  localMatrix: THREE.Matrix4,
  mirrored: boolean,
  record: SolidBrushGeometryEditRecord,
): void {
  if (!mirrored) {
    brushVertexSurfacesTransformAll(instance, localMatrix);
    return;
  }
  const previous = vertexMatrixPreviousSurfacesRead(record);
  for (let faceIndex = 0; faceIndex < instance.brush.faces.length; faceIndex += 1) {
    const surface = mirroredSurfaceMatch(previous, record.previousBrush, instance.brush, faceIndex, localMatrix);
    instance.setFaceSurface(faceIndex, surface);
  }
}

/**
 * Materializes live surfaces from one undo record.
 *
 * @param record Stored pre-edit state.
 * @returns Default and per-face surfaces.
 */
function vertexMatrixPreviousSurfacesRead(record: SolidBrushGeometryEditRecord): VertexMatrixPreviousSurfaces {
  const faceSurfaces = record.previousFaceSurfaces.map((entry) => (entry ? deserializeFaceSurface(entry) : undefined));
  return { defaultSurface: deserializeFaceSurface(record.previousDefaultSurface), faceSurfaces };
}

/**
 * Copies the matching pre-mirror surface onto one mirrored face.
 *
 * @param previous Pre-mirror default and per-face surfaces.
 * @param previousBrush Pre-mirror geometry.
 * @param brush Mirrored geometry.
 * @param faceIndex Mirrored face index.
 * @param localMatrix Brush-local mirror matrix.
 * @returns Transformed surface, or the transformed default.
 */
function mirroredSurfaceMatch(
  previous: VertexMatrixPreviousSurfaces,
  previousBrush: SolidBrush,
  brush: SolidBrush,
  faceIndex: number,
  localMatrix: THREE.Matrix4,
): FaceSurfaceDescription {
  const plane = brush.planes[faceIndex];
  const previousIndex = plane ? mirroredSourceFaceIndex(previousBrush, plane, localMatrix) : -1;
  const surface = previousIndex >= 0 ? previous.faceSurfaces[previousIndex] : undefined;
  return brushVertexSurfaceTransform(surface ?? previous.defaultSurface, localMatrix);
}

/**
 * Finds the pre-mirror face whose transformed plane matches a mirrored plane.
 *
 * @param previousBrush Pre-mirror geometry.
 * @param plane Mirrored face plane.
 * @param localMatrix Brush-local mirror matrix.
 * @returns Previous face index, or -1 when none match.
 */
function mirroredSourceFaceIndex(previousBrush: SolidBrush, plane: SolidPlane, localMatrix: THREE.Matrix4): number {
  for (let index = 0; index < previousBrush.planes.length; index += 1) {
    const previousPlane = previousBrush.planes[index];
    if (previousPlane && previousPlane.applyMatrix4(localMatrix).isAlignedWith(plane)) {
      return index;
    }
  }
  return -1;
}
