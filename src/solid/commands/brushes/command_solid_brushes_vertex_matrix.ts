import * as THREE from 'three';
import { UndoCommand } from '@/commands/command_undo.js';
import { SolidBrush } from '@/solid/brush/solid_brush.js';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidPlane } from '@/solid/brush/solid_plane.js';
import { SolidBrushValidator } from '@/solid/brush/solid_brush_validator.js';
import { solidBrushPreviewSwap } from '@/solid/brush/solid_brush_preview_swap.js';
import { solidHullBrushFromPoints } from '@/solid/algorithm/surface/solid_hull_brush.js';
import {
  brushVertexSurfaceTransform,
  brushVertexSurfacesTransformAll,
} from '@/transform/vertex/brush_vertex_surface_transform.js';
import {
  deserializeFaceSurface,
  type FaceSurfaceDescription,
  type FaceSurfaceDescriptionSerialized,
} from '@/texture/uv_matrix/face_surface_description.js';

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

/** Result of a vertex-matrix command run. */
export interface SolidBrushVertexMatrixResult {
  /** Brush instances that were transformed. */
  transformed: SolidBrushInstance[];
  /** Brush instances skipped because the result would be invalid. */
  skipped: SolidBrushInstance[];
}

interface BrushUndoRecord {
  model: SolidModel;
  brushId: string;
  previousBrush: SolidBrush;
  previousDefaultSurface: FaceSurfaceDescriptionSerialized;
  previousFaceSurfaces: (FaceSurfaceDescriptionSerialized | undefined)[];
}

/**
 * Undoable command that applies a world-space affine matrix to the vertices of
 * several solid brushes at once. Orientation-flipping matrices (mirrors)
 * rebuild the convex topology so planes keep pointing outward. Brushes whose
 * result would be invalid are skipped and reported through the result.
 */
export class CommandSolidBrushesVertexMatrix implements UndoCommand {
  private readonly entries: SolidBrushVertexMatrixEntry[];
  private readonly undoRecords: BrushUndoRecord[];
  private readonly transformed: SolidBrushInstance[];
  private readonly skipped: SolidBrushInstance[];
  private executed: boolean;

  /**
   * Creates a vertex-matrix command.
   *
   * @param entries Brushes with their world-space matrices.
   */
  constructor(entries: readonly SolidBrushVertexMatrixEntry[]) {
    this.entries = entries.slice();
    this.undoRecords = [];
    this.transformed = [];
    this.skipped = [];
    this.executed = false;
  }

  /**
   * Returns which brushes transformed and which were skipped.
   *
   * @returns Lists of brush instances.
   */
  getResult(): SolidBrushVertexMatrixResult {
    return { transformed: this.transformed.slice(), skipped: this.skipped.slice() };
  }

  /** Applies the matrix to every valid brush and rebuilds the owning models. */
  execute(): void {
    if (this.executed) {
      return;
    }
    this.entryBrushesApply();
    this.modelsRebuild();
    this.executed = true;
  }

  /** Restores every transformed brush to its pre-command geometry. */
  undo(): void {
    if (!this.executed) {
      return;
    }
    for (const record of this.undoRecords) {
      this.recordRestore(record);
    }
    this.modelsRebuild();
    this.executed = false;
  }

  /** Applies one matrix entry per brush. */
  private entryBrushesApply(): void {
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
    const candidate = candidateBrushBuild(instance.brush, localMatrix, mirrored);
    if (!candidate || !SolidBrushValidator.validate(candidate).valid) {
      this.skipped.push(instance);
      return;
    }
    const record = recordCreate(entry.model, instance);
    solidBrushPreviewSwap(instance, candidate);
    if (entry.lockTextures) {
      surfacesTransform(instance, localMatrix, mirrored, record);
    }
    this.undoRecords.push(record);
    this.transformed.push(instance);
  }

  /**
   * Restores one undo record onto its brush.
   *
   * @param record Stored pre-command state.
   */
  private recordRestore(record: BrushUndoRecord): void {
    const instance = record.model.findBrush(record.brushId);
    if (!instance) {
      return;
    }
    solidBrushPreviewSwap(instance, record.previousBrush);
    instance.restoreFaceSurfaces(record.previousDefaultSurface, record.previousFaceSurfaces);
  }

  /** Rebuilds every solid model touched by the command once. */
  private modelsRebuild(): void {
    const models = new Set<SolidModel>();
    for (const record of this.undoRecords) {
      models.add(record.model);
    }
    for (const model of models) {
      model.markDirty();
      model.rebuild(true);
    }
  }
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
function candidateBrushBuild(brush: SolidBrush, localMatrix: THREE.Matrix4, mirrored: boolean): SolidBrush | null {
  if (!mirrored) {
    const candidate = brush.clone();
    candidate.transformVertices(localMatrix);
    return candidate;
  }
  const points = brush.vertices.map((vertex) => vertex.clone().applyMatrix4(localMatrix));
  return solidHullBrushFromPoints(points);
}

/**
 * Stores the pre-command geometry and surfaces of one brush.
 *
 * @param model Owning solid model.
 * @param instance Brush about to transform.
 * @returns Undo record for the brush.
 */
function recordCreate(model: SolidModel, instance: SolidBrushInstance): BrushUndoRecord {
  return {
    model,
    brushId: instance.id,
    previousBrush: instance.brush.clone(),
    previousDefaultSurface: instance.serializeDefaultSurface(),
    previousFaceSurfaces: instance.serializeFaceSurfaces(),
  };
}

/**
 * Updates face surfaces after the vertices moved.
 *
 * @param instance Brush holding the new geometry.
 * @param localMatrix Brush-local matrix that moved the vertices.
 * @param mirrored True when the geometry was rebuilt from a mirrored hull.
 * @param record Undo record holding the previous surfaces.
 */
function surfacesTransform(
  instance: SolidBrushInstance,
  localMatrix: THREE.Matrix4,
  mirrored: boolean,
  record: BrushUndoRecord,
): void {
  if (!mirrored) {
    brushVertexSurfacesTransformAll(instance, localMatrix);
    return;
  }
  const previous = recordSurfacesMaterialize(record);
  for (let faceIndex = 0; faceIndex < instance.brush.faces.length; faceIndex += 1) {
    const surface = mirroredSurfaceMatch(previous, record.previousBrush, instance.brush, faceIndex, localMatrix);
    instance.setFaceSurface(faceIndex, surface);
  }
}

/**
 * Materializes live surfaces from one undo record.
 *
 * @param record Stored pre-command state.
 * @returns Default and per-face surfaces.
 */
function recordSurfacesMaterialize(record: BrushUndoRecord): {
  defaultSurface: FaceSurfaceDescription;
  faceSurfaces: (FaceSurfaceDescription | undefined)[];
} {
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
  previous: { defaultSurface: FaceSurfaceDescription; faceSurfaces: (FaceSurfaceDescription | undefined)[] },
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
