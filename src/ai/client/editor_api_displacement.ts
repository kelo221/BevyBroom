import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import { findBrush } from './editor_api_lookup.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import type { DisplacementFaceSurface } from '@/displacement/model/displacement_types.js';
import {
  displacementSurfaceClone,
  displacementSurfaceCreate,
  displacementSurfaceRead,
  displacementVertexCount,
} from '@/displacement/model/displacement_face_surface.js';
import { displacementFaceFailureRead } from '@/displacement/model/displacement_face_eligibility.js';
import { CommandDisplacementEdit } from '@/displacement/commands/command_displacement_edit.js';
import type { ControllerDisplacementActions } from '@/displacement/controller/controller_displacement_actions.js';
import { displacementActionsSharedRead } from '@/displacement/controller/displacement_actions_shared.js';

/** Power a created displacement gets when the call names none. */
const EDITOR_API_DISPLACEMENT_DEFAULT_POWER = 3;

/** Arguments a set_face_displacement call may override on the stored surface. */
const EDITOR_API_DISPLACEMENT_OVERRIDE_KEYS = ['power', 'elevation', 'scale', 'offsets', 'alphas'] as const;

/** Brush face resolved from brushId and faceIndex arguments. */
interface EditorApiDisplacementTarget {
  brush: SolidBrushInstance;
  faceTarget: SolidFaceTextureTarget;
}

/**
 * Creates, edits and removes the displacements of authored brush faces and
 * selects adjacent displaced faces.
 */
export class EditorApiDisplacement {
  /**
   * Creates the displacement tools.
   *
   * @param host Live editor systems.
   */
  constructor(private readonly host: EditorApiHost) {}

  /**
   * Runs a displacement tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no displacement tool.
   */
  displacementToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    if (name === 'set_face_displacement') {
      return this.faceDisplacementSet(args);
    }
    return name === 'select_adjacent_displacements' ? this.adjacentDisplacementsSelect(args) : null;
  }

  /**
   * Optionally replaces the face selection, then adds the displaced faces
   * adjacent to the selected displaced faces.
   *
   * @param args Tool arguments with an optional faces list.
   * @returns Result listing the face selection afterwards.
   */
  private adjacentDisplacementsSelect(args: Record<string, unknown>): McpToolResult {
    const actions = displacementActionsSharedRead();
    if (!actions) {
      return failResult('Face tools are not available');
    }
    const seedFailure = this.selectionSeed(actions, args['faces']);
    if (seedFailure) {
      return failResult(seedFailure);
    }
    const countBefore = actions.selectedTargetsRead().length;
    const result = actions.selectAdjacent();
    const faces = actions.selectedTargetsRead().map((target) => editorApiDisplacementFaceDescribe(target));
    return okResult(result.message, { addedCount: faces.length - countBefore, faces });
  }

  /**
   * Replaces the face selection with the faces a call names.
   *
   * @param actions Installed displacement actions.
   * @param faces Faces argument: a list of { brushId, faceIndex }, or undefined
   *   to keep the selection.
   * @returns Message explaining a bad argument, or null when the selection is
   *   ready.
   */
  private selectionSeed(actions: ControllerDisplacementActions, faces: unknown): string | null {
    if (faces === undefined) {
      return null;
    }
    if (!Array.isArray(faces)) {
      return 'faces must be a list of { brushId, faceIndex }';
    }
    const targets: SolidFaceTextureTarget[] = [];
    for (const entry of faces) {
      const target = this.targetResolve(entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {});
      if (typeof target === 'string') {
        return target;
      }
      targets.push(target.faceTarget);
    }
    return actions.selectionReplace(targets) ? null : 'The face selection cannot be changed';
  }

  /**
   * Creates, edits or removes the displacement of one brush face.
   *
   * @param args Tool arguments with brushId, faceIndex, action and surface
   *   values.
   * @returns Result describing the face after the edit.
   */
  private faceDisplacementSet(args: Record<string, unknown>): McpToolResult {
    const target = this.targetResolve(args);
    if (typeof target === 'string') {
      return failResult(target);
    }
    const displacement = this.displacementPlan(target.brush, target.faceTarget.surfaceIndex, args);
    if (typeof displacement === 'string') {
      return failResult(displacement);
    }
    this.host.commandStack.push(new CommandDisplacementEdit([{ target: target.faceTarget, displacement }]));
    this.host.refreshAfterWorldMutation();
    return okResult(displacement ? 'Displacement stored' : 'Displacement removed', {
      brushId: target.brush.id,
      faceIndex: target.faceTarget.surfaceIndex,
      displaced: displacement !== null,
      power: displacement?.power ?? null,
      vertexCount: displacement ? displacementVertexCount(displacement.power) : 0,
      flags: displacement ? { ...displacement.flags } : null,
    });
  }

  /**
   * Plans the displacement the face receives from the call's action.
   *
   * @param brush Brush owning the face.
   * @param surfaceIndex Face index.
   * @param args Tool arguments.
   * @returns New displacement, null to remove it, or a message explaining the
   *   bad argument.
   */
  private displacementPlan(
    brush: SolidBrushInstance,
    surfaceIndex: number,
    args: Record<string, unknown>,
  ): DisplacementFaceSurface | null | string {
    const action = args['action'];
    const stored = brush.faceDisplacementRead(surfaceIndex);
    if (action === 'create') {
      const failure = displacementFaceFailureRead(brush, surfaceIndex);
      return (
        failure ?? displacementWithOverrides(displacementSurfaceCreate(EDITOR_API_DISPLACEMENT_DEFAULT_POWER), args)
      );
    }
    if (action !== 'set' && action !== 'destroy') {
      return 'action must be create, set or destroy';
    }
    if (!stored) {
      return `Face ${surfaceIndex} has no displacement; use action create first`;
    }
    return action === 'destroy' ? null : displacementWithOverrides(displacementSurfaceClone(stored), args);
  }

  /**
   * Resolves the brush face of a tool call.
   *
   * @param args Tool arguments with brushId and faceIndex.
   * @returns Target, or a message explaining the bad argument.
   */
  private targetResolve(args: Record<string, unknown>): EditorApiDisplacementTarget | string {
    const brushId = args['brushId'];
    const found = typeof brushId === 'string' ? findBrush(this.host.worldObject, brushId) : null;
    if (!found) {
      return `Brush not found: ${String(brushId)}`;
    }
    const faceIndex = args['faceIndex'];
    const faceCount = found.brush.brush.faces.length;
    if (typeof faceIndex !== 'number' || !Number.isInteger(faceIndex) || faceIndex < 0 || faceIndex >= faceCount) {
      return `faceIndex must be an integer from 0 to ${faceCount - 1}`;
    }
    return {
      brush: found.brush,
      faceTarget: { model: found.model, brushId: found.brush.id, surfaceIndex: faceIndex },
    };
  }
}

/**
 * Describes one selected brush face for a tool result.
 *
 * @param target Brush face.
 * @returns Brush id, face index and whether the face carries a displacement.
 */
export function editorApiDisplacementFaceDescribe(target: SolidFaceTextureTarget): {
  brushId: string;
  faceIndex: number;
  displaced: boolean;
} {
  const displacement = target.model.findBrush(target.brushId)?.faceDisplacementRead(target.surfaceIndex);
  return { brushId: target.brushId, faceIndex: target.surfaceIndex, displaced: displacement !== undefined };
}

/**
 * Applies the surface values a call names on top of a base displacement and
 * validates the result.
 *
 * @param base Displacement the call starts from.
 * @param args Tool arguments that may name power, elevation, scale, offsets,
 *   alphas and flags.
 * @returns Validated displacement, or a message naming the expected vertex
 *   count.
 */
function displacementWithOverrides(
  base: DisplacementFaceSurface,
  args: Record<string, unknown>,
): DisplacementFaceSurface | string {
  const record: Record<string, unknown> = { ...base, flags: displacementFlagsWithOverrides(base, args['flags']) };
  EDITOR_API_DISPLACEMENT_OVERRIDE_KEYS.forEach((key) => {
    if (args[key] !== undefined) {
      record[key] = args[key];
    }
  });
  if (args['power'] !== undefined && args['power'] !== base.power && args['offsets'] === undefined) {
    record['offsets'] = undefined;
    record['alphas'] = args['alphas'];
  }
  return (
    displacementSurfaceRead(record) ??
    'power must be 2, 3 or 4, offsets and alphas must hold (2^power+1)^2 finite numbers and flags must be booleans'
  );
}

/**
 * Merges the collision flags a call names over the base displacement's flags.
 *
 * @param base Displacement the call starts from.
 * @param flags Flags argument: an object naming some of noPhysicsCollision,
 *   noHullCollision, noRayCollision and seals, or undefined.
 * @returns Merged flag record for validation, or the raw argument when it is no
 *   object so validation rejects it.
 */
function displacementFlagsWithOverrides(base: DisplacementFaceSurface, flags: unknown): unknown {
  if (flags === undefined) {
    return base.flags;
  }
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) {
    return flags;
  }
  return { ...base.flags, ...(flags as Record<string, unknown>) };
}
