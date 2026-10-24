import { UndoCommand } from '@/commands/command_undo.js';
import { SolidBrush } from '@/solid/brush/solid_brush.js';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidBrushValidator } from '@/solid/brush/solid_brush_validator.js';
import { solidBrushPreviewSwap } from '@/solid/brush/solid_brush_preview_swap.js';
import type { FaceSurfaceDescriptionSerialized } from '@/texture/uv_matrix/face_surface_description.js';

/** Pre-edit geometry and surfaces of one brush. */
export interface SolidBrushGeometryEditRecord {
  /** Owning solid model. */
  model: SolidModel;
  /** Brush instance id. */
  brushId: string;
  /** Brush geometry before the edit. */
  previousBrush: SolidBrush;
  /** Default surface before the edit. */
  previousDefaultSurface: FaceSurfaceDescriptionSerialized;
  /** Per-face surfaces before the edit. */
  previousFaceSurfaces: (FaceSurfaceDescriptionSerialized | undefined)[];
}

/** Brushes an edit changed and brushes it refused. */
export interface SolidBrushGeometryEditResult {
  /** Brushes whose geometry was replaced. */
  edited: SolidBrushInstance[];
  /** Brushes left unchanged because the result would be invalid. */
  skipped: SolidBrushInstance[];
}

/**
 * Base for undoable commands that replace the geometry of several solid
 * brushes. Subclasses build one candidate brush per target and optionally
 * rewrite its surfaces; this base validates candidates, records undo state,
 * restores it on undo and rebuilds each touched model once.
 */
export abstract class CommandSolidBrushesGeometryEdit implements UndoCommand {
  private readonly records: SolidBrushGeometryEditRecord[] = [];
  private readonly edited: SolidBrushInstance[] = [];
  private readonly skipped: SolidBrushInstance[] = [];
  private executed = false;

  /**
   * Returns which brushes were edited and which were skipped.
   *
   * @returns Lists of brush instances.
   */
  getEditResult(): SolidBrushGeometryEditResult {
    return { edited: this.edited.slice(), skipped: this.skipped.slice() };
  }

  /** Edits every target brush and rebuilds the owning models. */
  execute(): void {
    if (this.executed) {
      return;
    }
    this.records.length = 0;
    this.edited.length = 0;
    this.skipped.length = 0;
    this.targetsEdit();
    solidModelsFullRebuild(this.records.map((record) => record.model));
    this.executed = true;
  }

  /** Restores every edited brush to its pre-command geometry and surfaces. */
  undo(): void {
    if (!this.executed) {
      return;
    }
    for (const record of this.records) {
      geometryEditRecordRestore(record);
    }
    solidModelsFullRebuild(this.records.map((record) => record.model));
    this.executed = false;
  }

  /** Edits every target brush through {@link brushEditApply}. */
  protected abstract targetsEdit(): void;

  /**
   * Replaces one brush with a candidate when the candidate is valid, records
   * undo state and lets the caller rewrite surfaces afterwards.
   *
   * @param model Owning solid model.
   * @param instance Brush instance to edit.
   * @param candidate New brush-local geometry, or null when it could not be
   *   built.
   * @param surfacesUpdate Rewrites surfaces of the edited brush from its
   *   record.
   */
  protected brushEditApply(
    model: SolidModel,
    instance: SolidBrushInstance,
    candidate: SolidBrush | null,
    surfacesUpdate: (record: SolidBrushGeometryEditRecord) => void,
  ): void {
    if (!candidate || !SolidBrushValidator.validate(candidate).valid) {
      this.skipped.push(instance);
      return;
    }
    const record = geometryEditRecordCreate(model, instance);
    solidBrushPreviewSwap(instance, candidate);
    surfacesUpdate(record);
    this.records.push(record);
    this.edited.push(instance);
  }
}

/**
 * Captures the pre-edit geometry and surfaces of one brush.
 *
 * @param model Owning solid model.
 * @param instance Brush about to change.
 * @returns Undo record for the brush.
 */
export function geometryEditRecordCreate(
  model: SolidModel,
  instance: SolidBrushInstance,
): SolidBrushGeometryEditRecord {
  return {
    model,
    brushId: instance.id,
    previousBrush: instance.brush.clone(),
    previousDefaultSurface: instance.serializeDefaultSurface(),
    previousFaceSurfaces: instance.serializeFaceSurfaces(),
  };
}

/**
 * Restores one undo record onto its brush when the brush still exists.
 *
 * @param record Stored pre-edit state.
 */
export function geometryEditRecordRestore(record: SolidBrushGeometryEditRecord): void {
  const instance = record.model.findBrush(record.brushId);
  if (!instance) {
    return;
  }
  solidBrushPreviewSwap(instance, record.previousBrush);
  instance.restoreFaceSurfaces(record.previousDefaultSurface, record.previousFaceSurfaces);
}

/**
 * Fully rebuilds each distinct solid model once.
 *
 * @param models Models to rebuild; duplicates are rebuilt once.
 */
export function solidModelsFullRebuild(models: Iterable<SolidModel>): void {
  for (const model of new Set(models)) {
    model.markDirty();
    model.rebuild(true);
  }
}
