import type { Vector3 } from 'three';
import type { EditorServices } from '@/editor/window/editor_services.js';
import type { TopologyWorkingEdge } from '@/edit/topology/topology_working_edge_key.js';
import { snapEditLoopCutParameterWithShift, snapEditWorldPointWithShift } from './layout_tool_editor_helpers.js';
import {
  layoutToolEditorEditModeActiveRead,
  layoutToolEditorEditModeCoordinatorRead,
  type LayoutToolEditorServicesContext,
} from './layout_tool_editor_services_context.js';

/** Edit Mode pick, topology, and session EditorServices. */
export type LayoutToolEditorEditModeServices = Pick<
  EditorServices,
  | 'isEditModeActive'
  | 'pickEditEdgeParameter'
  | 'splitEditEdge'
  | 'loopCutEditEdge'
  | 'projectLockedLoopCutParameter'
  | 'snapEditWorldPoint'
  | 'snapEditLoopCutParameter'
  | 'dissolveEditSelection'
  | 'deleteEditSelection'
  | 'mergeEditSelection'
  | 'getPrimaryScene'
  | 'getEditSession'
  | 'beginEditSelectPointerDown'
>;

/** Edit Mode pick and topology EditorServices. */
type LayoutToolEditorEditModePickServices = Pick<
  EditorServices,
  'isEditModeActive' | 'pickEditEdgeParameter' | 'splitEditEdge' | 'loopCutEditEdge' | 'projectLockedLoopCutParameter'
>;

/** Edit Mode snap, dissolve, and session EditorServices. */
type LayoutToolEditorEditModeSessionServices = Pick<
  EditorServices,
  | 'snapEditWorldPoint'
  | 'snapEditLoopCutParameter'
  | 'dissolveEditSelection'
  | 'deleteEditSelection'
  | 'mergeEditSelection'
  | 'getPrimaryScene'
  | 'getEditSession'
  | 'beginEditSelectPointerDown'
>;

/**
 * Builds Edit Mode pick, topology, and session services.
 *
 * @param ctx Shared editor services context.
 * @returns Edit Mode services.
 */
export function layoutToolEditorEditModeServicesCreate(
  ctx: LayoutToolEditorServicesContext,
): LayoutToolEditorEditModeServices {
  return {
    ...layoutToolEditorEditModePickServicesCreate(ctx),
    ...layoutToolEditorEditModeSessionServicesCreate(ctx),
  };
}

/**
 * Builds Edit Mode pick and topology services.
 *
 * @param ctx Shared editor services context.
 * @returns Pick services.
 */
function layoutToolEditorEditModePickServicesCreate(
  ctx: LayoutToolEditorServicesContext,
): LayoutToolEditorEditModePickServices {
  return {
    isEditModeActive: () => layoutToolEditorEditModeActiveRead(ctx),
    pickEditEdgeParameter: (clientX, clientY, ownerDocument) =>
      layoutToolEditorEditEdgeParameterPick(ctx, clientX, clientY, ownerDocument),
    splitEditEdge: (targetId, vertexA, vertexB, parameter) =>
      layoutToolEditorEditModeCoordinatorRead(ctx)?.splitEdge(targetId, vertexA, vertexB, parameter) === true,
    loopCutEditEdge: (targetId, vertexA, vertexB, parameter, lockedEdges) =>
      layoutToolEditorEditLoopCutApply(ctx, targetId, vertexA, vertexB, parameter, lockedEdges),
    projectLockedLoopCutParameter: (clientX, clientY, worldA, worldB, ownerDocument) =>
      layoutToolEditorLockedLoopCutParameterProject(ctx, clientX, clientY, worldA, worldB, ownerDocument),
  };
}

/**
 * Builds Edit Mode snap, dissolve, and session services.
 *
 * @param ctx Shared editor services context.
 * @returns Session services.
 */
function layoutToolEditorEditModeSessionServicesCreate(
  ctx: LayoutToolEditorServicesContext,
): LayoutToolEditorEditModeSessionServices {
  return {
    snapEditWorldPoint: (position, shiftHeld) => snapEditWorldPointWithShift(ctx.deps, position, shiftHeld),
    snapEditLoopCutParameter: (worldA, worldB, parameter, shiftHeld, range) =>
      snapEditLoopCutParameterWithShift(ctx.deps, worldA, worldB, parameter, shiftHeld, range),
    dissolveEditSelection: () => layoutToolEditorEditModeCoordinatorRead(ctx)?.dissolveSelection() === true,
    deleteEditSelection: () => layoutToolEditorEditModeCoordinatorRead(ctx)?.deleteSelection() === true,
    mergeEditSelection: (mode) => layoutToolEditorEditModeCoordinatorRead(ctx)?.mergeSelection(mode) === true,
    getPrimaryScene: () => layoutToolEditorEditModeCoordinatorRead(ctx)?.getOverlayScene() ?? null,
    getEditSession: () => layoutToolEditorEditSessionRead(ctx),
    beginEditSelectPointerDown: (clientX, clientY, isShiftPressed, isCtrlPressed, ownerDocument) =>
      layoutToolEditorEditSelectPointerDownBegin(ctx, clientX, clientY, isShiftPressed, isCtrlPressed, ownerDocument),
  };
}

/**
 * Picks an edit-domain edge and split parameter when Edit Mode is live.
 *
 * @param ctx Shared editor services context.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @param ownerDocument Document that owns the client coordinates, or undefined.
 * @returns Edge hit, or null.
 */
function layoutToolEditorEditEdgeParameterPick(
  ctx: LayoutToolEditorServicesContext,
  clientX: number,
  clientY: number,
  ownerDocument?: Document | null,
) {
  return (
    layoutToolEditorEditModeCoordinatorRead(ctx)?.pickEdgeParameterAtClient(clientX, clientY, ownerDocument ?? null) ??
    null
  );
}

/**
 * Applies a loop cut from an edit-domain edge.
 *
 * @param ctx Shared editor services context.
 * @param targetId Domain target id.
 * @param vertexA Edge start vertex.
 * @param vertexB Edge end vertex.
 * @param parameter Split parameter.
 * @param lockedEdges Locked belt edges, or undefined.
 * @returns True when the cut ran.
 */
function layoutToolEditorEditLoopCutApply(
  ctx: LayoutToolEditorServicesContext,
  targetId: string,
  vertexA: number,
  vertexB: number,
  parameter: number,
  lockedEdges?: readonly TopologyWorkingEdge[],
): boolean {
  return (
    layoutToolEditorEditModeCoordinatorRead(ctx)?.loopCut(targetId, vertexA, vertexB, parameter, lockedEdges) === true
  );
}

/**
 * Projects the pointer onto a locked loop-cut edge.
 *
 * @param ctx Shared editor services context.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @param worldA Edge start.
 * @param worldB Edge end.
 * @param ownerDocument Document that owns the client coordinates, or undefined.
 * @returns Parameter, or null.
 */
function layoutToolEditorLockedLoopCutParameterProject(
  ctx: LayoutToolEditorServicesContext,
  clientX: number,
  clientY: number,
  worldA: Vector3,
  worldB: Vector3,
  ownerDocument?: Document | null,
): number | null {
  return (
    layoutToolEditorEditModeCoordinatorRead(ctx)?.projectLockedLoopCutParameter(
      clientX,
      clientY,
      worldA,
      worldB,
      ownerDocument ?? null,
    ) ?? null
  );
}

/**
 * Returns the open Edit Mode session.
 *
 * @param ctx Shared editor services context.
 * @returns Session, or null.
 */
function layoutToolEditorEditSessionRead(ctx: LayoutToolEditorServicesContext) {
  const coordinator = layoutToolEditorEditModeCoordinatorRead(ctx);
  if (!coordinator || !coordinator.isActive()) {
    return null;
  }
  return coordinator.getSession();
}

/**
 * Starts an Edit Mode component pick at a client point.
 *
 * @param ctx Shared editor services context.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @param isShiftPressed Additive selection.
 * @param isCtrlPressed Toggle selection.
 * @param ownerDocument Document that owns the client coordinates, or undefined.
 * @returns True when the pick path ran.
 */
function layoutToolEditorEditSelectPointerDownBegin(
  ctx: LayoutToolEditorServicesContext,
  clientX: number,
  clientY: number,
  isShiftPressed: boolean,
  isCtrlPressed: boolean,
  ownerDocument?: Document | null,
): boolean {
  return (
    layoutToolEditorEditModeCoordinatorRead(ctx)?.pickAtClientPoint(
      clientX,
      clientY,
      isShiftPressed,
      isCtrlPressed,
      ownerDocument ?? ctx.getPointerOwnerDocument(),
    ) === true
  );
}
