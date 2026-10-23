import * as THREE from 'three';
import { UndoCommand } from '@/commands/command_undo.js';
import { SolidBrush } from '@/solid/brush/solid_brush.js';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidBrushValidator } from '@/solid/brush/solid_brush_validator.js';
import { solidBrushPreviewSwap } from '@/solid/brush/solid_brush_preview_swap.js';
import { transferSurfacesByPlaneMatch } from '@/solid/brush/solid_brush_surface_transfer.js';
import {
  deserializeFaceSurface,
  type FaceSurfaceDescriptionSerialized,
} from '@/texture/uv_matrix/face_surface_description.js';

/** Rounding modes a vertex snap can use. */
export type SnapVerticesStep = 'grid' | 'integer';

/** Result of a vertex snap run. */
export interface CommandSolidBrushesSnapVerticesResult {
  /** Brushes whose vertices were rounded. */
  snapped: SolidBrushInstance[];
  /** Brushes left unchanged because rounding would break them. */
  skipped: SolidBrushInstance[];
}

interface SnapUndoRecord {
  model: SolidModel;
  brushId: string;
  previousBrush: SolidBrush;
  previousDefaultSurface: FaceSurfaceDescriptionSerialized;
  previousFaceSurfaces: (FaceSurfaceDescriptionSerialized | undefined)[];
}

/**
 * Undoable command that rounds every vertex of several solid brushes to a step
 * size in world space. Brushes that would become invalid are skipped and
 * reported.
 */
export class CommandSolidBrushesSnapVertices implements UndoCommand {
  private readonly step: number;
  private readonly modelsByBrush: Map<string, SolidModel | null>;
  private readonly records: SnapUndoRecord[];
  private readonly snapped: SolidBrushInstance[];
  private readonly skipped: SolidBrushInstance[];
  private executed: boolean;

  /**
   * Creates a vertex snap command.
   *
   * @param models Models whose brushes snap (owner lookup fallback).
   * @param brushes Brush instances to snap.
   * @param step 'grid' rounds to the grid interval, 'integer' to whole units.
   * @param interval Grid interval used by the 'grid' step.
   */
  constructor(
    models: readonly SolidModel[],
    brushes: readonly SolidBrushInstance[],
    step: SnapVerticesStep,
    interval: number,
  ) {
    this.step = step === 'grid' ? Math.max(interval, 1e-6) : 1;
    this.modelsByBrush = new Map(brushes.map((brush) => [brush.id, snapModelFor(models, brush)]));
    this.records = [];
    this.snapped = [];
    this.skipped = [];
    this.executed = false;
  }

  /**
   * Returns which brushes snapped and which were skipped.
   *
   * @returns Lists of brush instances.
   */
  getResult(): CommandSolidBrushesSnapVerticesResult {
    return { snapped: this.snapped.slice(), skipped: this.skipped.slice() };
  }

  /** Rounds every valid brush and rebuilds the owning models. */
  execute(): void {
    if (this.executed) {
      return;
    }
    for (const [brushId, model] of this.modelsByBrush) {
      this.brushSnap(model, brushId);
    }
    this.modelsRebuild();
    this.executed = true;
  }

  /** Restores every snapped brush to its pre-command geometry. */
  undo(): void {
    if (!this.executed) {
      return;
    }
    for (const record of this.records) {
      this.recordRestore(record);
    }
    this.modelsRebuild();
    this.executed = false;
  }

  /**
   * Rounds one brush when the result stays valid.
   *
   * @param model Owning model, or null to skip.
   * @param brushId Brush instance id.
   */
  private brushSnap(model: SolidModel | null, brushId: string): void {
    const instance = model?.findBrush(brushId);
    if (!model || !instance) {
      return;
    }
    const record = snapRecordCreate(model, instance);
    const candidate = this.candidateBuild(instance);
    if (!candidate) {
      this.skipped.push(instance);
      return;
    }
    solidBrushPreviewSwap(instance, candidate);
    this.surfacesTransfer(instance, record);
    this.records.push(record);
    this.snapped.push(instance);
  }

  /**
   * Builds the rounded brush of one instance.
   *
   * @param instance Brush instance.
   * @returns Rounded brush, or null when it would be invalid.
   */
  private candidateBuild(instance: SolidBrushInstance): SolidBrush | null {
    const candidate = instance.brush.clone();
    const toWorld = snapBrushWorldMatrix(instance);
    const toLocal = toWorld.clone().invert();
    for (const vertex of candidate.vertices) {
      snapVertexRound(vertex, toWorld, toLocal, this.step);
    }
    candidate.recalculatePlanes();
    return SolidBrushValidator.validate(candidate).valid ? candidate : null;
  }

  /**
   * Copies plane-matched surfaces onto the rounded geometry.
   *
   * @param instance Brush holding the rounded geometry.
   * @param record Undo record with the previous surfaces.
   */
  private surfacesTransfer(instance: SolidBrushInstance, record: SnapUndoRecord): void {
    const previousDefault = deserializeFaceSurface(record.previousDefaultSurface);
    const previousSurfaces = record.previousFaceSurfaces.map((entry) =>
      entry ? deserializeFaceSurface(entry) : undefined,
    );
    const transferred = transferSurfacesByPlaneMatch(
      record.previousBrush,
      previousDefault,
      previousSurfaces,
      instance.brush,
    );
    instance.restoreFaceSurfaces(transferred.defaultSurface, transferred.faceSurfaces);
  }

  /**
   * Restores one undo record onto its brush.
   *
   * @param record Stored pre-command state.
   */
  private recordRestore(record: SnapUndoRecord): void {
    const instance = record.model.findBrush(record.brushId);
    if (!instance) {
      return;
    }
    solidBrushPreviewSwap(instance, record.previousBrush);
    instance.restoreFaceSurfaces(record.previousDefaultSurface, record.previousFaceSurfaces);
  }

  /** Rebuilds every model touched by the command once. */
  private modelsRebuild(): void {
    const models = new Set<SolidModel>();
    for (const record of this.records) {
      models.add(record.model);
    }
    for (const model of models) {
      model.markDirty();
      model.rebuild(true);
    }
  }
}

/**
 * Resolves the owning model of one brush.
 *
 * @param models Models in the scene.
 * @param brush Brush instance.
 * @returns Owning model, or null.
 */
function snapModelFor(models: readonly SolidModel[], brush: SolidBrushInstance): SolidModel | null {
  const mesh = brush.mesh;
  if (mesh) {
    const fromMesh = SolidModel.fromObject(mesh);
    if (fromMesh) {
      return fromMesh;
    }
  }
  return models.find((model) => model.findBrush(brush.id)) ?? null;
}

/**
 * Stores the pre-command geometry and surfaces of one brush.
 *
 * @param model Owning solid model.
 * @param instance Brush about to snap.
 * @returns Undo record for the brush.
 */
function snapRecordCreate(model: SolidModel, instance: SolidBrushInstance): SnapUndoRecord {
  return {
    model,
    brushId: instance.id,
    previousBrush: instance.brush.clone(),
    previousDefaultSurface: instance.serializeDefaultSurface(),
    previousFaceSurfaces: instance.serializeFaceSurfaces(),
  };
}

/**
 * Returns the world matrix of one brush.
 *
 * @param instance Brush instance with a scene pose.
 * @returns Local-to-world matrix.
 */
function snapBrushWorldMatrix(instance: SolidBrushInstance): THREE.Matrix4 {
  if (instance.mesh) {
    instance.mesh.updateWorldMatrix(true, false);
    return instance.mesh.matrixWorld.clone();
  }
  return instance.getLocalMatrix().clone();
}

/**
 * Rounds one vertex through world space.
 *
 * @param vertex Brush-local vertex (mutated in place).
 * @param toWorld Local-to-world matrix.
 * @param toLocal World-to-local matrix.
 * @param step Rounding step.
 */
function snapVertexRound(vertex: THREE.Vector3, toWorld: THREE.Matrix4, toLocal: THREE.Matrix4, step: number): void {
  const world = vertex.clone().applyMatrix4(toWorld);
  world.x = Math.round(world.x / step) * step;
  world.y = Math.round(world.y / step) * step;
  world.z = Math.round(world.z / step) * step;
  vertex.copy(world.applyMatrix4(toLocal));
}
