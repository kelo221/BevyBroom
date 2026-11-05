import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import { CommandStackTransaction } from '@/commands/command_stack_transaction.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import type { DisplacementSculptTool } from '@/displacement/model/displacement_types.js';
import { CommandDisplacementEdit } from '@/displacement/commands/command_displacement_edit.js';
import type { DisplacementSculptBrush, DisplacementSculptDab } from './brushes/displacement_sculpt_brush.js';
import { displacementSculptBrushCreate } from './brushes/displacement_sculpt_brush_factory.js';
import { DisplacementSculptFace } from './displacement_sculpt_face.js';
import { DisplacementSculptOps } from './displacement_sculpt_ops.js';

/** Brush size and strength of a sculpt stroke. */
export interface DisplacementSculptStrokeSettings {
  /** Paint tool. */
  tool: DisplacementSculptTool;
  /** World radius of each dab. */
  radius: number;
  /** World distance one dab moves the center vertex. */
  distance: number;
  /** 1 raises, -1 lowers. */
  direction: 1 | -1;
  /** Random seed for tools with random output. */
  seed: number;
}

/**
 * One paint stroke over displaced faces. Every dab is its own displacement
 * edit; finishing the stroke folds them into a single undo step.
 */
export class DisplacementSculptStroke {
  private readonly transaction: CommandStackTransaction;
  private readonly brush: DisplacementSculptBrush;
  private dabCount = 0;

  /**
   * Begins a stroke.
   *
   * @param commandStack Stack receiving the stroke's undo step.
   * @param targets Displaced faces the stroke may change.
   * @param settings Tool, radius, strength and direction.
   */
  constructor(
    private readonly commandStack: CommandStack,
    private readonly targets: readonly SolidFaceTextureTarget[],
    private readonly settings: DisplacementSculptStrokeSettings,
  ) {
    this.transaction = new CommandStackTransaction(commandStack);
    this.brush = displacementSculptBrushCreate(settings.tool, settings.seed);
  }

  /**
   * Paints one dab centered on a world point.
   *
   * @param center World-space dab center.
   * @returns Number of faces the dab changed.
   */
  dabApply(center: THREE.Vector3): number {
    const faces = DisplacementSculptFace.listFromTargets(this.targets);
    const changed = DisplacementSculptOps.paintGeometry(faces, this.dabBuild(center), this.brush);
    if (changed.length === 0) {
      return 0;
    }
    this.commandStack.push(new CommandDisplacementEdit(changed.map((face) => face.editBuild())));
    this.dabCount += 1;
    return changed.length;
  }

  /**
   * Ends the stroke and folds its dabs into one undo step.
   *
   * @returns Number of dabs that changed geometry.
   */
  finish(): number {
    this.transaction.commit();
    return this.dabCount;
  }

  /**
   * Builds the dab parameters for a center point.
   *
   * @param center World-space dab center.
   * @returns Dab parameters.
   */
  private dabBuild(center: THREE.Vector3): DisplacementSculptDab {
    return {
      center: center.clone(),
      radius: this.settings.radius,
      distance: this.settings.distance,
      direction: this.settings.direction,
    };
  }
}
