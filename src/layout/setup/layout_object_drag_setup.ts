import type * as THREE from 'three';
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
import type { ObjectDragViewportSource } from '@/tools/object_drag/object_drag_viewport.js';
import { ShapeDrawBrushCommit } from '@/tools/shape_draw/shape_draw_brush_commit.js';
import type { ShapeDrawPreviewHost } from '@/tools/shape_draw/shape_draw_preview.js';
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
  return new ObjectDragController({
    viewportAtClientPoint,
    gridSnap: deps.gridSnap,
    userSnapEnabledRead: deps.getUserSnapEnabled,
    objectEditingAllowed: host.isObjectEditingAllowed,
    selection: deps.selectionManager,
    move: layoutObjectDragMoveDepsCreate(deps, host),
    brushCommit: layoutObjectDragBrushCommitCreate(deps, host),
    previewHost: host.helperScene,
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
 * Builds the committer that turns drawn boxes into brushes.
 *
 * @param deps Tool editor dependencies.
 * @param host Additional layout systems.
 * @returns Brush committer.
 */
function layoutObjectDragBrushCommitCreate(
  deps: LayoutToolEditorSetupDeps,
  host: LayoutObjectDragHost,
): ShapeDrawBrushCommit {
  return new ShapeDrawBrushCommit({
    commandStack: host.commandStack,
    worldObject: host.worldObject,
    selectObject: (mesh) => deps.selectionManager.selectObject(mesh),
    activeModelResolve: () => host.solidModelControllerRead()?.resolveActiveModel() ?? null,
    brushInsertParentResolve: (model) => host.solidModelControllerRead()?.resolveBrushInsertParent(model) ?? model.root,
    textureIdResolve: () => getStateTexturePaint().getLastTextureId(),
    afterWorldMutation: () => host.refreshAfterWorldMutation(),
  });
}
