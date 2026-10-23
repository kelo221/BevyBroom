import type { Object3D } from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { CommandSolidBrushHollow } from '@/tools/csg/solid/hollow/command_solid_brush_hollow.js';
import type { CommandSolidBrushHollowEntry } from '@/tools/csg/solid/hollow/command_solid_brush_hollow.js';
import { hollowWallsBuild } from '@/tools/csg/solid/hollow/hollow_walls_build.js';
import { solidBrushHullSelection } from '@/tools/hull/handler_solid_brush_hull.js';

/** Services the hollow action needs. */
export interface HandlerSolidHollowDeps {
  /** Undo stack. */
  commandStack: CommandStack;
  /** Current object selection. */
  getSelectedObjects: () => readonly Object3D[];
  /** Current wall thickness (grid size). */
  thicknessRead: () => number;
  /** Status line. */
  showStatusMessage: (message: string) => void;
}

/**
 * Replaces every selected solid brush with grouped hollow walls as thick as the
 * current grid size, as one undo step.
 */
export class HandlerSolidHollow {
  private readonly deps: HandlerSolidHollowDeps;

  /**
   * Creates a hollow action.
   *
   * @param deps Selection, thickness, undo, and status.
   */
  constructor(deps: HandlerSolidHollowDeps) {
    this.deps = deps;
  }

  /**
   * Hollows the selected brushes.
   *
   * @returns Created wall meshes, or null when nothing could hollow.
   */
  run(): Object3D[] | null {
    const brushes = solidBrushHullSelection(this.deps.getSelectedObjects());
    if (brushes.length === 0) {
      this.deps.showStatusMessage('Hollow needs selected solid brushes');
      return null;
    }
    const entries = this.entriesBuild(brushes);
    if (entries.length === 0) {
      this.deps.showStatusMessage('Hollow: every selected brush is too thin');
      return null;
    }
    return this.commit(entries, brushes.length - entries.length);
  }

  /**
   * Builds hollow entries for every brush thick enough to hollow.
   *
   * @param brushes Selected brush instances.
   * @returns Entries in selection order.
   */
  private entriesBuild(brushes: readonly SolidBrushInstance[]): CommandSolidBrushHollowEntry[] {
    const entries: CommandSolidBrushHollowEntry[] = [];
    for (const brush of brushes) {
      this.entryPush(entries, brush);
    }
    return entries;
  }

  /**
   * Appends the entry of one brush when its walls can be built.
   *
   * @param entries Entry accumulator.
   * @param brush Selected brush instance.
   */
  private entryPush(entries: CommandSolidBrushHollowEntry[], brush: SolidBrushInstance): void {
    const model = brush.mesh ? SolidModel.fromObject(brush.mesh) : null;
    if (!model) {
      return;
    }
    const walls = hollowWallsBuild(brush, brush.getModelSpaceBrush(), this.deps.thicknessRead());
    if (!walls || walls.length === 0) {
      return;
    }
    entries.push({ model, brushId: brush.id, walls, operation: brush.operation });
  }

  /**
   * Pushes the one-step hollow command and reports the result.
   *
   * @param entries Hollow entries.
   * @param skippedCount Brushes left unchanged.
   * @returns Created wall meshes, or null.
   */
  private commit(entries: readonly CommandSolidBrushHollowEntry[], skippedCount: number): Object3D[] | null {
    const command = new CommandSolidBrushHollow(entries);
    this.deps.commandStack.push(command);
    const meshes = command.getCreatedMeshes();
    const skippedSuffix = skippedCount > 0 ? `, ${skippedCount} too thin` : '';
    this.deps.showStatusMessage(`Hollowed ${entries.length} brush(es) into ${meshes.length} walls${skippedSuffix}`);
    return meshes.length > 0 ? meshes : null;
  }
}
