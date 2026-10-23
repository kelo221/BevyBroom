import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import {
  CommandSolidBrushesVertexMatrix,
  type SolidBrushVertexMatrixEntry,
} from '@/solid/commands/brushes/command_solid_brushes_vertex_matrix.js';
import { solidBrushHullSelection } from '@/tools/hull/handler_solid_brush_hull.js';
import { flipMirrorMatrixBuild, type FlipAxis } from '@/transform/flip/flip_axis.js';
import type { GridSnap } from '@/transform/snap/grid_snap.js';

/** Services the flip selection action needs. */
export interface HandlerFlipSelectionDeps {
  /** Undo stack. */
  commandStack: CommandStack;
  /** Current object selection. */
  getSelectedObjects: () => readonly THREE.Object3D[];
  /** Grid snap used to snap the mirror center, or null to keep it raw. */
  gridSnap: GridSnap | null;
  /** True while texture position lock keeps faces aligned. */
  isTexturePositionLockEnabled: () => boolean;
  /** Status line. */
  showStatusMessage: (message: string) => void;
}

/** Result of one flip run. */
export interface FlipSelectionResult {
  /** Mirrored brush instances. */
  flipped: SolidBrushInstance[];
  /** World axis the selection was mirrored across. */
  axis: FlipAxis;
  /** Plane coordinate of the mirror. */
  center: number;
}

/**
 * Mirrors the selected solid brushes across the grid-snapped center of their
 * bounds as one undo step.
 */
export class HandlerFlipSelection {
  private readonly deps: HandlerFlipSelectionDeps;

  /**
   * Creates a flip action.
   *
   * @param deps Selection, grid, texture lock, undo, and status.
   */
  constructor(deps: HandlerFlipSelectionDeps) {
    this.deps = deps;
  }

  /**
   * Flips the selection across one world axis through the bounds center.
   *
   * @param axis World mirror axis.
   * @returns Result, or null when nothing could flip.
   */
  flip(axis: FlipAxis): FlipSelectionResult | null {
    const brushes = solidBrushHullSelection(this.deps.getSelectedObjects());
    if (brushes.length === 0) {
      this.deps.showStatusMessage('Flip needs selected solid brushes');
      return null;
    }
    const center = this.selectionMirrorCenter(brushes, axis);
    const matrix = flipMirrorMatrixBuild(axis, center);
    const entries = this.entriesBuild(brushes, matrix);
    const command = new CommandSolidBrushesVertexMatrix(entries);
    this.deps.commandStack.push(command);
    return this.resultBuild(command.getResult().transformed, axis, center);
  }

  /**
   * Computes the grid-snapped mirror plane coordinate of the selection bounds.
   *
   * @param brushes Selected brushes.
   * @param axis World mirror axis.
   * @returns Plane coordinate along the axis.
   */
  private selectionMirrorCenter(brushes: readonly SolidBrushInstance[], axis: FlipAxis): number {
    const bounds = this.selectionWorldBounds(brushes);
    const rawCenter = (bounds.min[axis] + bounds.max[axis]) / 2;
    return this.centerSnap(rawCenter);
  }

  /**
   * Snaps a mirror coordinate to the grid when snapping is enabled.
   *
   * @param rawCenter Unsnapped coordinate.
   * @returns Snapped coordinate.
   */
  private centerSnap(rawCenter: number): number {
    const gridSnap = this.deps.gridSnap;
    if (!gridSnap || !gridSnap.isEnabled()) {
      return rawCenter;
    }
    return gridSnap.snapValue(rawCenter);
  }

  /**
   * Builds the world bounds of the selection brush vertices.
   *
   * @param brushes Selected brushes.
   * @returns World bounds.
   */
  private selectionWorldBounds(brushes: readonly SolidBrushInstance[]): THREE.Box3 {
    const bounds = new THREE.Box3();
    for (const brush of brushes) {
      this.brushWorldBoundsExpand(bounds, brush);
    }
    return bounds;
  }

  /**
   * Grows bounds by one brush's world vertices.
   *
   * @param bounds Bounds accumulator.
   * @param brush Brush instance.
   */
  private brushWorldBoundsExpand(bounds: THREE.Box3, brush: SolidBrushInstance): void {
    const modelBrush = brush.getModelSpaceBrush();
    const model = brush.mesh ? SolidModel.fromObject(brush.mesh) : null;
    if (!model) {
      modelBrush.vertices.forEach((vertex) => bounds.expandByPoint(vertex));
      return;
    }
    model.root.updateWorldMatrix(true, false);
    for (const vertex of modelBrush.vertices) {
      bounds.expandByPoint(vertex.clone().applyMatrix4(model.root.matrixWorld));
    }
  }

  /**
   * Builds one command entry per selected brush.
   *
   * @param brushes Selected brushes.
   * @param matrix World mirror matrix.
   * @returns Command entries.
   */
  private entriesBuild(brushes: readonly SolidBrushInstance[], matrix: THREE.Matrix4): SolidBrushVertexMatrixEntry[] {
    const lockTextures = this.deps.isTexturePositionLockEnabled();
    return brushes.flatMap((brush) => this.entryBuild(brush, matrix, lockTextures));
  }

  /**
   * Builds the command entry of one brush.
   *
   * @param brush Selected brush.
   * @param matrix World mirror matrix.
   * @param lockTextures True when UV rows follow the vertices.
   * @returns One entry, or none when the brush has no model.
   */
  private entryBuild(
    brush: SolidBrushInstance,
    matrix: THREE.Matrix4,
    lockTextures: boolean,
  ): SolidBrushVertexMatrixEntry[] {
    const model = brush.mesh ? SolidModel.fromObject(brush.mesh) : null;
    if (!model) {
      return [];
    }
    return [{ model, brushId: brush.id, matrix: matrix.clone(), lockTextures }];
  }

  /**
   * Builds the flip result and reports skipped brushes.
   *
   * @param flipped Transformed brush instances.
   * @param axis World mirror axis.
   * @param center Mirror plane coordinate.
   * @returns Result.
   */
  private resultBuild(flipped: SolidBrushInstance[], axis: FlipAxis, center: number): FlipSelectionResult {
    this.deps.showStatusMessage(`Flipped ${flipped.length} brush(es) across ${axis}=${center.toFixed(3)}`);
    return { flipped, axis, center };
  }
}
