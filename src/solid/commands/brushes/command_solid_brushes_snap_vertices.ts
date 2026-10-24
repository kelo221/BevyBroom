import * as THREE from 'three';
import { SolidBrush } from '@/solid/brush/solid_brush.js';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { CommandSolidBrushesGeometryEdit } from './command_solid_brushes_geometry_edit.js';

/** Rounding modes a vertex snap can use. */
export type SnapVerticesStep = 'grid' | 'integer';

/** Smallest rounding step accepted for the grid mode. */
const SNAP_VERTICES_MIN_STEP = 1e-6;

/**
 * Undoable command that rounds every vertex of several solid brushes to a step
 * size in world space. Brushes that would become invalid are skipped and
 * reported through the edit result.
 */
export class CommandSolidBrushesSnapVertices extends CommandSolidBrushesGeometryEdit {
  private readonly step: number;
  private readonly modelsByBrush: Map<string, SolidModel | null>;

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
    super();
    this.step = step === 'grid' ? Math.max(interval, SNAP_VERTICES_MIN_STEP) : 1;
    this.modelsByBrush = new Map(brushes.map((brush) => [brush.id, snapModelFor(models, brush)]));
  }

  /** Rounds every target brush whose result stays valid. */
  protected targetsEdit(): void {
    for (const [brushId, model] of this.modelsByBrush) {
      this.brushSnap(model, brushId);
    }
  }

  /**
   * Rounds one brush. Rounding keeps the face order, so every face keeps its
   * surface by index.
   *
   * @param model Owning model, or null to ignore the brush.
   * @param brushId Brush instance id.
   */
  private brushSnap(model: SolidModel | null, brushId: string): void {
    const instance = model?.findBrush(brushId);
    if (!model || !instance) {
      return;
    }
    const candidate = snapCandidateBuild(instance, this.step);
    this.brushEditApply(model, instance, candidate, () => undefined);
  }
}

/**
 * Builds the rounded brush of one instance.
 *
 * @param instance Brush instance.
 * @param step Rounding step in world units.
 * @returns Rounded brush with recalculated planes.
 */
function snapCandidateBuild(instance: SolidBrushInstance, step: number): SolidBrush {
  const candidate = instance.brush.clone();
  const toWorld = snapBrushWorldMatrix(instance);
  const toLocal = toWorld.clone().invert();
  for (const vertex of candidate.vertices) {
    snapVertexRound(vertex, toWorld, toLocal, step);
  }
  candidate.recalculatePlanes();
  return candidate;
}

/**
 * Resolves the owning model of one brush.
 *
 * @param models Models in the scene.
 * @param brush Brush instance.
 * @returns Owning model, or null.
 */
function snapModelFor(models: readonly SolidModel[], brush: SolidBrushInstance): SolidModel | null {
  const fromMesh = brush.mesh ? SolidModel.fromObject(brush.mesh) : null;
  if (fromMesh) {
    return fromMesh;
  }
  return models.find((model) => model.findBrush(brush.id)) ?? null;
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
  world.set(Math.round(world.x / step) * step, Math.round(world.y / step) * step, Math.round(world.z / step) * step);
  vertex.copy(world.applyMatrix4(toLocal));
}
