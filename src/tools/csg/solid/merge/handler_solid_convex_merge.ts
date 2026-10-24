import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { CommandUndoBatch } from '@/commands/command_undo_batch.js';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { CommandSolidBrushesDelete } from '@/solid/commands/brushes/command_solid_brushes_delete.js';
import { CommandSolidBrushHull } from '@/tools/hull/command_solid_brush_hull.js';
import {
  solidBrushHullBuild,
  solidBrushHullFromWorldPoints,
  type SolidBrushHullBuild,
} from '@/tools/hull/solid_brush_hull_build.js';
import {
  convexMergeFacePointsBuild,
  type ConvexMergeFacePick,
} from '@/tools/csg/solid/merge/convex_merge_face_points.js';

/** Name allocated for merged brushes. */
const CONVEX_MERGE_BRUSH_NAME = 'Convex Merge';

/** Result of one convex merge run. */
export interface ConvexMergeResult {
  /** Brush created by the merge. */
  created: SolidBrushInstance | null;
}

/**
 * Builds and commits one convex merge brush from selected brushes (removed
 * after the merge) or selected faces (originals kept), as one undo step.
 */
export class HandlerSolidConvexMerge {
  private readonly commandStack: CommandStack;
  private readonly showStatusMessage: (message: string) => void;

  /**
   * Creates a convex merge action.
   *
   * @param commandStack Undo stack.
   * @param showStatusMessage Status line.
   */
  constructor(commandStack: CommandStack, showStatusMessage: (message: string) => void) {
    this.commandStack = commandStack;
    this.showStatusMessage = showStatusMessage;
  }

  /**
   * Merges selected brushes into their convex hull.
   *
   * @param brushes Selected brush instances (two or more).
   * @returns Created brush, or null when the hull fails.
   */
  mergeBrushes(brushes: readonly SolidBrushInstance[]): SolidBrushInstance | null {
    if (brushes.length < 2) {
      this.showStatusMessage('Convex merge needs two or more brushes');
      return null;
    }
    const model = this.brushModelResolve(brushes);
    const built = model ? solidBrushHullBuild(brushes, model.root) : null;
    if (!model || !built) {
      this.showStatusMessage('Convex merge needs a 3D set of brushes in one solid model');
      return null;
    }
    return this.commitBuilt(model, built, this.originalMeshes(brushes));
  }

  /**
   * Merges selected brush faces into their convex hull, keeping originals.
   *
   * @param picks Selected brush faces.
   * @returns Created brush, or null when the hull fails.
   */
  mergeFaces(picks: readonly ConvexMergeFacePick[]): SolidBrushInstance | null {
    const points = convexMergeFacePointsBuild(picks);
    if (!points) {
      this.showStatusMessage('Convex merge needs solid faces with corners');
      return null;
    }
    const built = solidBrushHullFromWorldPoints(points.worldPoints, points.sources, points.model.root.matrixWorld);
    if (!built) {
      this.showStatusMessage('Convex merge needs a 3D set of faces');
      return null;
    }
    return this.commitBuilt(points.model, built, []);
  }

  /**
   * Resolves the solid model of the first selected brush.
   *
   * @param brushes Selected brush instances.
   * @returns Model, or null.
   */
  private brushModelResolve(brushes: readonly SolidBrushInstance[]): SolidModel | null {
    const mesh = brushes[0]?.mesh;
    return mesh ? SolidModel.fromObject(mesh) : null;
  }

  /**
   * Lists the meshes of the selected brushes.
   *
   * @param brushes Selected brush instances.
   * @returns Brush preview meshes.
   */
  private originalMeshes(brushes: readonly SolidBrushInstance[]): THREE.Mesh[] {
    return brushes.flatMap((brush) => (brush.mesh ? [brush.mesh] : []));
  }

  /**
   * Commits one built hull as a single undo step.
   *
   * @param model Model receiving the merged brush.
   * @param built Built hull with surfaces.
   * @param originalMeshes Originals to remove in brush mode.
   * @returns Created brush, or null.
   */
  private commitBuilt(
    model: SolidModel,
    built: SolidBrushHullBuild,
    originalMeshes: readonly THREE.Mesh[],
  ): SolidBrushInstance | null {
    const addHull = new CommandSolidBrushHull(model, built.brush, built.surfaces, CONVEX_MERGE_BRUSH_NAME);
    addHull.execute();
    const created = addHull.getCreatedBrush();
    if (!created) {
      this.showStatusMessage('Convex merge could not build the hull brush');
      return null;
    }
    this.stackRecord(addHull, originalMeshes);
    this.showStatusMessage(`Merged into ${created.name}`);
    return created;
  }

  /**
   * Records the executed steps on the stack as one entry.
   *
   * @param addHull Executed hull-add step.
   * @param originalMeshes Originals removed in brush mode.
   */
  private stackRecord(addHull: CommandSolidBrushHull, originalMeshes: readonly THREE.Mesh[]): void {
    if (originalMeshes.length === 0) {
      this.commandStack.recordExecuted(addHull);
      return;
    }
    const deleteOriginals = new CommandSolidBrushesDelete([...originalMeshes]);
    deleteOriginals.execute();
    this.commandStack.recordExecuted(CommandUndoBatch.fromExecuted([addHull, deleteOriginals]));
  }
}
