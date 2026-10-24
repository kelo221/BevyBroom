import { UndoCommand } from '@/commands/command_undo.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import type { FaceSurfaceDescription } from '@/texture/uv_matrix/face_surface_description.js';

/** One authored solid brush face a face edit targets. */
export interface SolidFaceTextureTarget {
  /** Solid model owning the brush. */
  model: SolidModel;
  /** Brush instance id. */
  brushId: string;
  /** Face index on the brush. */
  surfaceIndex: number;
}

/** Surface of one face before an edit, kept for undo. */
interface SolidFaceSurfaceSnapshot {
  target: SolidFaceTextureTarget;
  previousSurface: FaceSurfaceDescription;
}

/**
 * Undoable edit of the surfaces of authored solid brush faces. Subclasses
 * decide how each face changes; this base keeps the previous surfaces and
 * remeshes the touched brushes without rebuilding the CSG result.
 */
export abstract class CommandTextureSolidFaceEdit implements UndoCommand {
  private readonly targets: SolidFaceTextureTarget[];
  private snapshots: SolidFaceSurfaceSnapshot[] = [];
  private executed = false;

  /**
   * Creates a face edit over brush faces.
   *
   * @param targets Brush faces to edit.
   */
  constructor(targets: readonly SolidFaceTextureTarget[]) {
    this.targets = targets.slice();
  }

  /** Edits every target face and remeshes each affected brush. */
  execute(): void {
    if (this.executed) {
      return;
    }
    this.snapshots = [];
    const edited = this.targets.filter((target) => this.targetEdit(target));
    this.presentationsRefresh(edited);
    this.executed = true;
  }

  /** Restores the previous surfaces and remeshes. */
  undo(): void {
    if (!this.executed) {
      return;
    }
    const restored = this.snapshots.filter((snapshot) => this.snapshotRestore(snapshot)).map((entry) => entry.target);
    this.presentationsRefresh(restored);
    this.snapshots = [];
    this.executed = false;
  }

  /**
   * Returns how many faces the last execution changed.
   *
   * @returns Edited face count.
   */
  getEditedFaceCount(): number {
    return this.snapshots.length;
  }

  /**
   * Changes one face of a brush.
   *
   * @param brush Brush owning the face.
   * @param surfaceIndex Face index.
   * @returns True when the face changed.
   */
  protected abstract faceEdit(brush: SolidBrushInstance, surfaceIndex: number): boolean;

  /**
   * Snapshots and edits one target face.
   *
   * @param target Brush face to edit.
   * @returns True when the face changed.
   */
  private targetEdit(target: SolidFaceTextureTarget): boolean {
    const brush = target.model.findBrush(target.brushId);
    if (!brush || target.surfaceIndex < 0 || target.surfaceIndex >= brush.brush.faces.length) {
      return false;
    }
    const previousSurface = brush.getFaceSurface(target.surfaceIndex);
    if (!this.faceEdit(brush, target.surfaceIndex)) {
      return false;
    }
    this.snapshots.push({ target, previousSurface });
    return true;
  }

  /**
   * Restores one face surface snapshot.
   *
   * @param snapshot Previous surface.
   * @returns True when the brush still exists.
   */
  private snapshotRestore(snapshot: SolidFaceSurfaceSnapshot): boolean {
    const brush = snapshot.target.model.findBrush(snapshot.target.brushId);
    if (!brush) {
      return false;
    }
    brush.setFaceSurface(snapshot.target.surfaceIndex, snapshot.previousSurface);
    return true;
  }

  /**
   * Remeshes the brushes of the given faces without rebuilding the CSG result.
   *
   * @param targets Faces whose brushes changed.
   */
  private presentationsRefresh(targets: readonly SolidFaceTextureTarget[]): void {
    const brushIdsByModel = new Map<SolidModel, Set<string>>();
    for (const target of targets) {
      const brushIds = brushIdsByModel.get(target.model) ?? new Set<string>();
      brushIds.add(target.brushId);
      brushIdsByModel.set(target.model, brushIds);
    }
    for (const [model, brushIds] of brushIdsByModel) {
      model.refreshBrushPresentations([...brushIds]);
    }
  }
}
