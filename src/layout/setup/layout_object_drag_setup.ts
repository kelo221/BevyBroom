import * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { TransformExecutor } from '@/transform/core/transform_executor.js';
import type { TransformDragSession } from '@/transform/core/session_transform_drag.js';
import { TransformCommandPusher } from '@/transform/core/transform_command_pusher.js';
import type { TextureLockSettings } from '@/texture/lock/texture_lock_settings.js';
import type { SolidModelController } from '@/solid/controller/solid_model_controller.js';
import { filterUnlockedObjects } from '@/utils/object_lock.js';
import { resolveTransformTargets } from '@/selection/object/resolve_transform_targets.js';
import { getStateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import { ObjectDragController, type ObjectDragControllerMoveDeps } from '@/tools/object_drag/object_drag_controller.js';
import { ObjectDragViewport, type ObjectDragViewportSource } from '@/tools/object_drag/object_drag_viewport.js';
import { ShapeDrawBrushCommit, type ShapeDrawBrushCommitDeps } from '@/tools/shape_draw/shape_draw_brush_commit.js';
import type { ShapeDrawPreviewHost } from '@/tools/shape_draw/shape_draw_preview.js';
import { getShapeDrawSettings } from '@/tools/shape_draw/shapes/shape_draw_settings.js';
import { PolygonBrushCommitter } from '@/tools/polygon/polygon_brush_committer.js';
import { getStatePolygonTool } from '@/tools/polygon/state_polygon_tool.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { getStateEntityPlace } from '@/tools/entity_place/state_entity_place.js';
import type { LayoutToolEditorSetupDeps } from './layout_tool_editor_setup.js';

/** Layout systems object dragging needs beyond the tool editor dependencies. */
export interface LayoutObjectDragHost {
  /** Undo history. */
  commandStack: CommandStack;
  /** World root new solid models are parented under. */
  worldObject: THREE.Object3D;
  /** Applies snapped translations. */
  transformExecutor: TransformExecutor;
  /** Helper scene for editor-only previews. */
  helperScene: ShapeDrawPreviewHost;
  /**
   * Returns the texture lock settings.
   *
   * @returns Texture lock settings, or null before they exist.
   */
  textureLockRead: () => TextureLockSettings | null;
  /**
   * Returns the solid model controller.
   *
   * @returns Controller, or null before it exists.
   */
  solidModelControllerRead: () => SolidModelController | null;
  /**
   * Duplicates hierarchy objects and selects the copies.
   *
   * @param objects Objects to duplicate.
   */
  duplicateHierarchyObjects: (objects: THREE.Object3D[]) => void;
  /**
   * Returns whether object transforms are allowed right now.
   *
   * @returns False while another mode owns the mouse.
   */
  isObjectEditingAllowed: () => boolean;
  /** Refreshes viewports and panels after the world changed. */
  refreshAfterWorldMutation: () => void;
}

/**
 * Builds the object drag controller from the tool editor dependencies.
 *
 * @param deps Tool editor dependencies.
 * @param host Additional layout systems.
 * @param viewportAtClientPoint Finds the interactive viewport under a client
 *   point.
 * @returns Object drag controller.
 */
export function layoutObjectDragControllerCreate(
  deps: LayoutToolEditorSetupDeps,
  host: LayoutObjectDragHost,
  viewportAtClientPoint: (clientX: number, clientY: number) => ObjectDragViewportSource | null,
): ObjectDragController {
  const commitDeps = layoutObjectDragBrushCommitDepsCreate(deps, host);
  layoutPolygonAndSprinkleWire(deps, commitDeps, viewportAtClientPoint);
  return new ObjectDragController({
    viewportAtClientPoint,
    gridSnap: deps.gridSnap,
    userSnapEnabledRead: deps.getUserSnapEnabled,
    objectEditingAllowed: host.isObjectEditingAllowed,
    selection: deps.selectionManager,
    move: layoutObjectDragMoveDepsCreate(deps, host),
    brushCommit: new ShapeDrawBrushCommit(commitDeps),
    previewHost: host.helperScene,
    shapeSettings: getShapeDrawSettings(),
  });
}

/**
 * Builds the systems selection moves use.
 *
 * @param deps Tool editor dependencies.
 * @param host Additional layout systems.
 * @returns Move dependencies.
 */
function layoutObjectDragMoveDepsCreate(
  deps: LayoutToolEditorSetupDeps,
  host: LayoutObjectDragHost,
): ObjectDragControllerMoveDeps {
  return {
    transformExecutor: host.transformExecutor,
    commandStack: host.commandStack,
    transformTargetsResolve: () => layoutObjectDragTransformTargets(deps),
    duplicateHierarchyObjects: host.duplicateHierarchyObjects,
    translateUndoPush: (dragSession, targets) => layoutObjectDragTranslateUndoPush(deps, host, dragSession, targets),
    textureLockRebake: (meshes) => host.textureLockRead()?.applyContentTransformPolicy(meshes, true, false),
    liveVisuals: deps,
    afterCommit: (targets) => deps.onAfterTransformCommit(targets),
    afterCancel: () => host.refreshAfterWorldMutation(),
  };
}

/**
 * Returns the unlocked transform targets of the current selection.
 *
 * @param deps Tool editor dependencies.
 * @returns Transform targets.
 */
function layoutObjectDragTransformTargets(deps: LayoutToolEditorSetupDeps): THREE.Object3D[] {
  const selected = filterUnlockedObjects(deps.selectionManager.getAllSelectedObjectsAsArray());
  return filterUnlockedObjects(resolveTransformTargets(selected, deps.selectionManager.getInspectorObjects()));
}

/**
 * Pushes the translate undo entry for a finished move.
 *
 * @param deps Tool editor dependencies.
 * @param host Additional layout systems.
 * @param dragSession Pre-drag snapshot of the targets.
 * @param targets Moved objects.
 */
function layoutObjectDragTranslateUndoPush(
  deps: LayoutToolEditorSetupDeps,
  host: LayoutObjectDragHost,
  dragSession: TransformDragSession,
  targets: THREE.Object3D[],
): void {
  const pusher = new TransformCommandPusher(
    dragSession,
    deps.transformGizmo,
    host.transformExecutor,
    host.commandStack,
  );
  pusher.pushTranslateCommand(targets);
}

/**
 * Builds the commit dependency bag shared by ShapeDrawBrushCommit and
 * PolygonBrushCommitter.
 *
 * @param deps Tool editor dependencies.
 * @param host Additional layout systems.
 * @returns Brush commit dependencies.
 */
function layoutObjectDragBrushCommitDepsCreate(
  deps: LayoutToolEditorSetupDeps,
  host: LayoutObjectDragHost,
): ShapeDrawBrushCommitDeps {
  return {
    commandStack: host.commandStack,
    worldObject: host.worldObject,
    selectObject: (mesh) => deps.selectionManager.selectObject(mesh),
    selectObjects: (meshes) => deps.selectionManager.setSelection(meshes),
    activeModelResolve: () => host.solidModelControllerRead()?.resolveActiveModel() ?? null,
    brushInsertParentResolve: (model) => host.solidModelControllerRead()?.resolveBrushInsertParent(model) ?? model.root,
    textureIdResolve: () => getStateTexturePaint().getLastTextureId(),
    afterWorldMutation: () => host.refreshAfterWorldMutation(),
  };
}

/**
 * Wires `StatePolygonTool` and `StateSprinkleTool` to the live viewport and
 * brush committer.
 *
 * @param deps Tool editor dependencies.
 * @param commitDeps Brush commit dependencies.
 * @param viewportAtClientPoint Viewport lookup by client coordinates.
 */
function layoutPolygonAndSprinkleWire(
  deps: LayoutToolEditorSetupDeps,
  commitDeps: ShapeDrawBrushCommitDeps,
  viewportAtClientPoint: (clientX: number, clientY: number) => ObjectDragViewportSource | null,
): void {
  const polygonCommitter = new PolygonBrushCommitter(commitDeps);
  const polygonTool = getStatePolygonTool();
  polygonTool.commitDelegateWrite((recipe, target) =>
    target ? polygonCommitter.regenerateTarget(target, recipe) : polygonCommitter.commitRecipe(recipe),
  );
  polygonTool.clientPointProjectorWrite((cx, cy) =>
    projectClientPointOntoGridPlane(deps, viewportAtClientPoint, cx, cy),
  );
  getStateSprinkleTool().clientPointHandlerWrite((cx, cy) => getStateEntityPlace().placeAtClientPoint(cx, cy));
}

/**
 * Intersects a viewport pick ray with the working grid plane and returns the
 * snapped 2D `(u, v)` coordinate.
 *
 * @param deps Tool editor dependencies.
 * @param viewportAtClientPoint Viewport lookup.
 * @param clientX Client X.
 * @param clientY Client Y.
 * @returns 2D coordinate on the grid plane, or null.
 */
function projectClientPointOntoGridPlane(
  deps: LayoutToolEditorSetupDeps,
  viewportAtClientPoint: (clientX: number, clientY: number) => ObjectDragViewportSource | null,
  clientX: number,
  clientY: number,
): THREE.Vector2 | null {
  const source = viewportAtClientPoint(clientX, clientY);
  if (!source) return null;
  const ray = new ObjectDragViewport(source).rayAtClientPoint(clientX, clientY);
  const frame = deps.gridSnap.getPlaneFrame();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(frame.normal, frame.origin);
  const hit = ray.intersectPlane(plane, new THREE.Vector3());
  if (!hit) return null;
  const rel = hit.sub(frame.origin);
  const step = Math.max(0.125, deps.gridSnap.getInterval());
  const u = Math.round(rel.dot(frame.uAxis) / step) * step;
  const v = Math.round(rel.dot(frame.vAxis) / step) * step;
  return new THREE.Vector2(u, v);
}
