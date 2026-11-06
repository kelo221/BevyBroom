import type { CommandStack } from '@/commands/command_stack.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import type { DisplacementFaceSurface, DisplacementPower } from '@/displacement/model/displacement_types.js';
import { displacementSurfaceClone, displacementSurfaceCreate } from '@/displacement/model/displacement_face_surface.js';
import { displacementFaceFailureRead } from '@/displacement/model/displacement_face_eligibility.js';
import {
  CommandDisplacementEdit,
  type DisplacementFaceEdit,
} from '@/displacement/commands/command_displacement_edit.js';
import { DisplacementSculptOps } from '@/displacement/sculpt/displacement_sculpt_ops.js';
import { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';
import { DisplacementSew } from '@/displacement/sculpt/displacement_sew.js';
import { DisplacementAdjacentFaces } from '@/displacement/pick/displacement_adjacent_faces.js';
import {
  displacementAttributesApplyTo,
  displacementAttributesSharedRead,
  type DisplacementAttributeChanges,
  type DisplacementAttributesShared,
} from './displacement_attributes.js';

/** Outcome of one displacement action. */
export interface DisplacementActionResult {
  /** True when the action changed at least one face or the face selection. */
  ok: boolean;
  /** Status line describing the outcome. */
  message: string;
  /** Faces the action changed. */
  editedFaceCount: number;
}

/**
 * Selects brush faces in the face selection the actions read.
 *
 * @param targets Brush faces to select.
 * @param addToSelection When false, the current selection is replaced.
 */
export type DisplacementTargetsSelect = (targets: readonly SolidFaceTextureTarget[], addToSelection: boolean) => void;

/** Counts of the brush faces the actions apply to. */
export interface DisplacementSelectionSummary {
  /** Number of selected brush faces. */
  faceCount: number;
  /** Number of selected brush faces that carry a displacement. */
  displacedCount: number;
}

/**
 * Runs the Displacement tab actions (Create, Destroy, Subdivide, Invert Alpha,
 * Sew, Noise, Smooth, Attributes Apply, Select Adjacent) on the brush faces a
 * target source returns. Each editing action is one undo step.
 */
export class ControllerDisplacementActions {
  /**
   * Creates the actions.
   *
   * @param commandStack Stack receiving one command per action.
   * @param targetsRead Returns the brush faces the actions apply to.
   * @param targetsSelect Selects brush faces in the selection targetsRead
   *   reads, or null when the selection cannot be changed.
   */
  constructor(
    private readonly commandStack: CommandStack,
    private readonly targetsRead: () => SolidFaceTextureTarget[],
    private readonly targetsSelect: DisplacementTargetsSelect | null = null,
  ) {}

  /**
   * Returns the brush faces the actions apply to.
   *
   * @returns Selected brush faces.
   */
  selectedTargetsRead(): SolidFaceTextureTarget[] {
    return this.targetsRead();
  }

  /**
   * Counts the selected brush faces and the displaced ones among them.
   *
   * @returns Face counts.
   */
  selectionSummaryRead(): DisplacementSelectionSummary {
    const targets = this.targetsRead();
    const displacedCount = targets.filter((target) => this.storedDisplacementRead(target) !== undefined).length;
    return { faceCount: targets.length, displacedCount };
  }

  /**
   * Replaces the face selection with brush faces.
   *
   * @param targets Brush faces to select.
   * @returns True when the selection could be changed.
   */
  selectionReplace(targets: readonly SolidFaceTextureTarget[]): boolean {
    if (!this.targetsSelect) {
      return false;
    }
    this.targetsSelect(targets, false);
    return true;
  }

  /**
   * Adds the displaced faces adjacent to the selected displaced faces to the
   * face selection.
   *
   * @returns Action outcome; editedFaceCount stays 0 because no face changes.
   */
  selectAdjacent(): DisplacementActionResult {
    if (!this.targetsSelect) {
      return { ok: false, message: 'The face selection cannot be changed', editedFaceCount: 0 };
    }
    const adjacent = DisplacementAdjacentFaces.adjacentTargetsFind(this.displacedTargets());
    if (adjacent.length === 0) {
      return { ok: false, message: 'No adjacent displaced faces', editedFaceCount: 0 };
    }
    this.targetsSelect(adjacent, true);
    return { ok: true, message: `Selected ${adjacent.length} adjacent displacement(s)`, editedFaceCount: 0 };
  }

  /**
   * Gives every eligible target face a new flat displacement.
   *
   * @param power Subdivision power.
   * @param elevation Initial elevation in meters.
   * @returns Action outcome; names the first failure when no face qualifies.
   */
  create(power: DisplacementPower, elevation: number = 0): DisplacementActionResult {
    const targets = this.targetsRead();
    const failures: string[] = [];
    const edits = targets.flatMap((target) => {
      const failure = this.targetFailureRead(target);
      if (failure) failures.push(failure);
      return failure ? [] : [{ target, displacement: displacementSurfaceCreate(power, elevation) }];
    });
    return this.editsPush(edits, 'Created', failures[0] ?? 'Select brush faces first');
  }

  /**
   * Removes the displacement of every displaced target face.
   *
   * @returns Action outcome.
   */
  destroy(): DisplacementActionResult {
    const edits = this.displacedTargets().map((target) => ({ target, displacement: null }));
    return this.editsPush(edits, 'Destroyed', 'No displaced faces selected');
  }

  /**
   * Doubles the resolution of every displaced target face below the highest
   * power.
   *
   * @returns Action outcome.
   */
  subdivide(): DisplacementActionResult {
    return this.displacedEditsRun('Subdivided', (copy) => DisplacementSculptOps.subdivide(copy) ?? undefined);
  }

  /**
   * Flips the alphas of every displaced target face.
   *
   * @returns Action outcome.
   */
  invertAlpha(): DisplacementActionResult {
    return this.displacedEditsRun('Inverted alpha on', (copy) => {
      DisplacementSculptOps.invertAlpha(copy);
      return copy;
    });
  }

  /**
   * Smooths every displaced target face as a whole.
   *
   * @returns Action outcome.
   */
  smooth(): DisplacementActionResult {
    return this.displacedEditsRun('Smoothed', (copy) => {
      DisplacementSculptOps.smoothGeometry(copy);
      return copy;
    });
  }

  /**
   * Adds seeded random height between two distances to every displaced face.
   *
   * @param minDistance Smallest added distance in meters.
   * @param maxDistance Largest added distance in meters.
   * @param seed Random seed.
   * @returns Action outcome.
   */
  noise(minDistance: number, maxDistance: number, seed: number): DisplacementActionResult {
    return this.displacedEditsRun('Added noise to', (copy) => {
      DisplacementSculptOps.applyNoise(copy, minDistance, maxDistance, seed);
      return copy;
    });
  }

  /**
   * Writes power, elevation, scale and collision flags to every displaced
   * target face as one undo step.
   *
   * @param changes Attribute values to write; missing fields stay unchanged.
   * @returns Action outcome.
   */
  attributesApply(changes: DisplacementAttributeChanges): DisplacementActionResult {
    return this.displacedEditsRun('Applied attributes to', (copy) => displacementAttributesApplyTo(copy, changes));
  }

  /**
   * Reads the attribute values the displaced target faces share.
   *
   * @returns Shared power, elevation, scale and flags, null where they differ.
   */
  attributesSharedRead(): DisplacementAttributesShared {
    return displacementAttributesSharedRead(
      this.displacedTargets().flatMap((target) => {
        const stored = this.storedDisplacementRead(target);
        return stored ? [stored] : [];
      }),
    );
  }

  /**
   * Sews the shared edges of the displaced target faces.
   *
   * @returns Action outcome.
   */
  sew(): DisplacementActionResult {
    const faces = DisplacementSculptFace.listFromTargets(this.displacedTargets());
    const changed = DisplacementSew.sewSharedEdges(faces);
    return this.editsPush(
      changed.map((face) => face.editBuild()),
      'Sewed',
      'No shared displaced edges to sew',
    );
  }

  /**
   * Runs a transform on a copy of every displaced target face and stores the
   * results.
   *
   * @param verb Past-tense verb for the status line.
   * @param transform Returns the new displacement, or undefined to skip a face.
   * @returns Action outcome.
   */
  private displacedEditsRun(
    verb: string,
    transform: (copy: DisplacementFaceSurface) => DisplacementFaceSurface | undefined,
  ): DisplacementActionResult {
    const edits = this.displacedTargets().flatMap((target) => {
      const stored = this.storedDisplacementRead(target);
      const next = stored ? transform(displacementSurfaceClone(stored)) : undefined;
      return next ? [{ target, displacement: next }] : [];
    });
    return this.editsPush(edits, verb, 'No displaced faces selected');
  }

  /**
   * Returns the targets that currently carry a displacement.
   *
   * @returns Displaced brush faces.
   */
  private displacedTargets(): SolidFaceTextureTarget[] {
    return this.targetsRead().filter((target) => this.storedDisplacementRead(target) !== undefined);
  }

  /**
   * Returns the displacement a target face stores.
   *
   * @param target Brush face.
   * @returns Stored displacement, or undefined when the face is flat or gone.
   */
  private storedDisplacementRead(target: SolidFaceTextureTarget): Readonly<DisplacementFaceSurface> | undefined {
    return target.model.findBrush(target.brushId)?.faceDisplacementRead(target.surfaceIndex);
  }

  /**
   * Returns why a target face cannot receive a displacement.
   *
   * @param target Brush face.
   * @returns Failure message, or null when eligible.
   */
  private targetFailureRead(target: SolidFaceTextureTarget): string | null {
    const brush = target.model.findBrush(target.brushId);
    return brush ? displacementFaceFailureRead(brush, target.surfaceIndex) : `Brush not found: ${target.brushId}`;
  }

  /**
   * Pushes one displacement edit command for a list of edits.
   *
   * @param edits Face edits.
   * @param verb Past-tense verb for the success status line.
   * @param emptyMessage Status line when there is nothing to edit.
   * @returns Action outcome.
   */
  private editsPush(edits: DisplacementFaceEdit[], verb: string, emptyMessage: string): DisplacementActionResult {
    if (edits.length === 0) {
      return { ok: false, message: emptyMessage, editedFaceCount: 0 };
    }
    const command = new CommandDisplacementEdit(edits);
    this.commandStack.push(command);
    const editedFaceCount = command.getEditedFaceCount();
    return { ok: editedFaceCount > 0, message: `${verb} ${editedFaceCount} displacement(s)`, editedFaceCount };
  }
}
