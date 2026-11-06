import * as THREE from 'three';
import { TransformMode } from '@/types/transform_mode.js';
import {
  applyGridSnapPrecisionFromShift,
  restoreGridSnapUserPreference,
} from '@/transform/snap/grid_snap_shift_precision.js';
import { filterUnlockedObjects } from '@/utils/object_lock.js';
import { resolveTransformTargets } from '@/selection/object/resolve_transform_targets.js';
import type { EditorInputBridge } from '@/editor/window/editor_input_bridge.js';
import type { ISelectable } from '@/editor/i_selectable.js';
import type { Viewport3D } from '@/viewports/core/viewport_3d.js';
import type { Viewport2D } from '@/viewports/core/viewport_2d.js';
import { isPerspectiveViewportKind } from '@/viewports/core/viewport_kind.js';
import { SelectionClickThrough } from '@/selection/object/selection_click_through.js';
import { orderObjectPickStackForViewport } from '@/selection/object/selection_pick_order_2d.js';
import { BridgeComponentTransformInteraction } from '@/edit/transform/bridge_component_transform_interaction.js';
import {
  computeComponentTransformPivot,
  expandComponentSelectionToTransformVertices,
} from '@/edit/transform/component_transform_selection.js';
import {
  publishLayoutTransformLiveVisuals,
  shouldPublishLiveVisualsAfterModalKey,
} from './layout_transform_live_visuals.js';
import { audioViewportFocus } from '@/audio/spatial/audio_viewport_focus.js';
import { findPickSurfaceAtClientPoint } from '@/utils/pointer_client_hit.js';
import { snapLoopCutParameterToGridPlanes } from '@/edit/tool/edit_loop_cut_slide_snap.js';
import type { LoopCutBeltParameterRange } from '@/edit/topology/topology_loop_cut_belt_range.js';
import { layoutObjectDragControllerCreate } from './layout_object_drag_setup.js';
import type { ObjectDragController } from '@/tools/object_drag/object_drag_controller.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import type { LayoutToolEditorSetupDeps } from './layout_tool_editor_types.js';

/**
 * Builds the object pick stack under a client point via the hit viewport.
 *
 * @param deps Layout services.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @param viewport Optional pre-resolved viewport under the pointer.
 * @param ownerDocument Document that owns the client coordinates, or null.
 * @returns Near-to-far world meshes.
 */
export function pickObjectStackAtClientPoint(
  deps: LayoutToolEditorSetupDeps,
  clientX: number,
  clientY: number,
  viewport: Viewport3D | Viewport2D | null = null,
  ownerDocument: Document | null = null,
): THREE.Mesh[] {
  const hitViewport = viewport ?? findInteractiveViewportAtClientPoint(deps, clientX, clientY, ownerDocument);
  if (!hitViewport || typeof hitViewport.getObjectPickStack !== 'function') {
    return [];
  }
  const synthetic = createSyntheticMouseEvent(clientX, clientY);
  return hitViewport.getObjectPickStack(synthetic);
}

/**
 * Applies click selection at a client point with multi-select modifiers.
 *
 * @param deps Layout services.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @param additive True when Shift is held.
 * @param toggle True when Ctrl/Meta is held.
 * @param ownerDocument Document that owns the client coordinates, or null.
 */
export function applyObjectClickSelectionAtClientPoint(
  deps: LayoutToolEditorSetupDeps,
  clientX: number,
  clientY: number,
  additive: boolean,
  toggle: boolean,
  ownerDocument: Document | null = null,
): void {
  const viewport = findInteractiveViewportAtClientPoint(deps, clientX, clientY, ownerDocument);
  const stack = pickObjectStackAtClientPoint(deps, clientX, clientY, viewport, ownerDocument);
  if (stack.length === 0) {
    if (!additive && !toggle) {
      deps.selectionManager.clearSelection();
    }
    SelectionClickThrough.resetClickThrough();
    return;
  }
  const orderedStack = orderObjectPickStackForViewport(stack, shouldUseReverseOutlinerObjectPick(viewport));
  const picked = resolveObjectPickFromStack(orderedStack, deps.selectionManager, additive, toggle, clientX, clientY);
  if (picked) {
    deps.selectionManager.selectFromClick(picked, additive, toggle);
  }
}

/**
 * Chooses the mesh for a click from a pick-priority stack.
 *
 * @param orderedStack Unique world meshes in pick-priority order (3D
 *   near-to-far or 2D reverse outliner).
 * @param selectionManager Selection state for click-through.
 * @param additive True when Shift is held.
 * @param toggle True when Ctrl/Meta is held.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @returns Mesh to apply, or null.
 */
function resolveObjectPickFromStack(
  orderedStack: THREE.Mesh[],
  selectionManager: ManagerSelection,
  additive: boolean,
  toggle: boolean,
  clientX: number,
  clientY: number,
): THREE.Mesh | null {
  if (orderedStack.length === 0) {
    return null;
  }
  if (additive || toggle) {
    SelectionClickThrough.resetClickThrough();
    return orderedStack[0] ?? null;
  }
  return SelectionClickThrough.pickFromStack(orderedStack, selectionManager, clientX, clientY);
}

/**
 * Returns whether a viewport uses reverse outliner order for object picks (2D).
 *
 * @param viewport Interactive viewport under the pointer, or null.
 * @returns True for non-perspective (2D) viewports.
 */
function shouldUseReverseOutlinerObjectPick(viewport: Viewport3D | Viewport2D | null): boolean {
  if (!viewport) {
    return false;
  }
  if (typeof viewport.getViewportKind !== 'function') {
    return false;
  }
  return !isPerspectiveViewportKind(viewport.getViewportKind());
}

/**
 * Builds the object drag controller when the layout supplies its systems.
 *
 * @param deps Layout services.
 * @param getPointerOwnerDocument Returns the document that owns pointer
 *   samples.
 * @returns Object drag controller, or null when object dragging is off.
 */
export function objectDragControllerCreate(
  deps: LayoutToolEditorSetupDeps,
  getPointerOwnerDocument: () => Document | null,
): ObjectDragController | null {
  if (!deps.objectDragHost) {
    return null;
  }
  return layoutObjectDragControllerCreate(deps, deps.objectDragHost, (clientX, clientY) =>
    findInteractiveViewportAtClientPoint(deps, clientX, clientY, getPointerOwnerDocument()),
  );
}

/**
 * Finds the interactive viewport under a client point. Client coordinates are
 * window-local; when ownerDocument is set only panes in that document are
 * tested so detached popups never hit main-window panes.
 *
 * @param deps Layout services.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @param ownerDocument Optional document that owns the client coordinates.
 * @returns Viewport, or null.
 */
function findInteractiveViewportAtClientPoint(
  deps: LayoutToolEditorSetupDeps,
  clientX: number,
  clientY: number,
  ownerDocument: Document | null = null,
): Viewport3D | Viewport2D | null {
  return findPickSurfaceAtClientPoint(
    deps.getInteractiveViewports(),
    (viewport) => viewport.getContentElement(),
    clientX,
    clientY,
    ownerDocument,
  );
}

/**
 * Builds a minimal MouseEvent-like object for viewport pick helpers.
 *
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @returns Synthetic mouse event.
 */
function createSyntheticMouseEvent(clientX: number, clientY: number): MouseEvent {
  return {
    clientX,
    clientY,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as MouseEvent;
}

/**
 * Snaps a world point using the shared grid, with Shift disabling snap.
 *
 * @param deps Layout services.
 * @param position World point.
 * @param shiftHeld True when Shift is held.
 * @returns Snapped or original point.
 */
export function snapEditWorldPointWithShift(
  deps: LayoutToolEditorSetupDeps,
  position: THREE.Vector3,
  shiftHeld: boolean,
): THREE.Vector3 {
  const result = position.clone();
  applyGridSnapPrecisionFromShift(deps.gridSnap, shiftHeld, deps.getUserSnapEnabled());
  deps.gridSnap.snapWorldPosition(result);
  restoreGridSnapUserPreference(deps.gridSnap, deps.getUserSnapEnabled());
  return result;
}

/**
 * Snaps a loop-cut parameter along an edge without mutating the shared grid
 * snap.
 *
 * @param deps Layout services.
 * @param worldA Edge start.
 * @param worldB Edge end.
 * @param parameter Unsnapped parameter.
 * @param shiftHeld True when Shift disables snap.
 * @param range Belt window, or null.
 * @returns Snapped or original parameter.
 */
export function snapEditLoopCutParameterWithShift(
  deps: LayoutToolEditorSetupDeps,
  worldA: THREE.Vector3,
  worldB: THREE.Vector3,
  parameter: number,
  shiftHeld: boolean,
  range: LoopCutBeltParameterRange | null,
): number {
  return snapLoopCutParameterToGridPlanes(
    worldA,
    worldB,
    parameter,
    resolveLoopCutSnapEnabled(shiftHeld, deps.getUserSnapEnabled()),
    deps.gridSnap.getInterval(),
    deps.gridSnap.getPlaneFrame(),
    range,
  );
}

/**
 * Returns whether loop-cut grid snap is active for this pointer sample.
 *
 * @param shiftHeld True when Shift is held.
 * @param userSnapEnabled User snap preference.
 * @returns True when the cut should snap.
 */
function resolveLoopCutSnapEnabled(shiftHeld: boolean, userSnapEnabled: boolean): boolean {
  if (shiftHeld) {
    return false;
  }
  return userSnapEnabled;
}

/**
 * Yields selectable wrappers for selected objects.
 *
 * @param objects Selected objects.
 * @param cache Selectable cache by object identity.
 * @returns Iterable of selectables.
 */
export function* iterateSelectables(
  objects: THREE.Object3D[],
  cache: Map<THREE.Object3D, ISelectable>,
): Iterable<ISelectable> {
  for (const object of objects) {
    let selectable = cache.get(object);
    if (!selectable) {
      selectable = createSelectableForObject(object);
      cache.set(object, selectable);
    }
    selectable.selected = true;
    selectable.position.copy(object.position);
    yield selectable;
  }
}

/**
 * Creates an ISelectable wrapper for a Three.js object.
 *
 * @param object Scene object.
 * @returns Selectable wrapper.
 */
function createSelectableForObject(object: THREE.Object3D): ISelectable {
  return {
    selected: true,
    position: object.position.clone(),
    gpVector1: new THREE.Vector3(),
  };
}

/**
 * Resolves average screen position of the selection for widget placement.
 *
 * @param deps Layout services.
 * @returns Screen coordinates.
 */
export function resolveAverageScreenPosition(deps: LayoutToolEditorSetupDeps): { x: number; y: number } {
  const viewport = deps.getActiveViewport();
  const pickElement = viewport?.getContentElement();
  if (!pickElement) {
    return { x: 0, y: 0 };
  }
  const rect = pickElement.getBoundingClientRect();
  return {
    x: rect.left + rect.width * 0.5,
    y: rect.top + rect.height * 0.5,
  };
}

/**
 * Collects content elements for every interactive pane.
 *
 * @param deps Layout services.
 * @returns Pick elements in layout order.
 */
export function collectInteractivePickElements(deps: LayoutToolEditorSetupDeps): HTMLElement[] {
  const elements: HTMLElement[] = [];
  for (const viewport of deps.getInteractiveViewports()) {
    const content = viewport.getContentElement();
    if (content) {
      elements.push(content);
    }
  }
  return elements;
}

/**
 * Registers interactive viewport content elements for early audio focus hits
 * from the input bridge (before tools run).
 *
 * @param deps Layout services.
 */
export function syncAudioViewportContentRegistry(deps: LayoutToolEditorSetupDeps): void {
  audioViewportFocus.registerViewports(deps.getInteractiveViewports());
}

/**
 * Resolves camera and pick element for the interactive pane under a client
 * point. Client coordinates are document-local; when ownerDocument is set only
 * panes in that document are tested.
 *
 * @param deps Layout services.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @param ownerDocument Optional document that owns the client coordinates.
 * @returns Pick context, or null when the point is not over a pane.
 */
export function resolveInteractiveViewportAtClientPoint(
  deps: LayoutToolEditorSetupDeps,
  clientX: number,
  clientY: number,
  ownerDocument?: Document | null,
): { camera: THREE.Camera; pickElement: HTMLElement } | null {
  const viewport = findInteractiveViewportAtClientPoint(deps, clientX, clientY, ownerDocument ?? null);
  if (!viewport) {
    return null;
  }
  const pickElement = viewport.getContentElement();
  if (!pickElement) {
    return null;
  }
  return {
    camera: viewport.getCamera(),
    pickElement,
  };
}

/**
 * Returns the first interactive pane in a document (or any pane when document
 * is omitted).
 *
 * @param deps Layout services.
 * @param ownerDocument Document filter, or null for the first interactive pane.
 * @returns Pick context, or null when no pane exists.
 */
export function resolveFirstInteractiveViewportInDocument(
  deps: LayoutToolEditorSetupDeps,
  ownerDocument?: Document | null,
): { camera: THREE.Camera; pickElement: HTMLElement } | null {
  for (const viewport of deps.getInteractiveViewports()) {
    const pickElement = viewport.getContentElement();
    if (!pickElement) {
      continue;
    }
    if (ownerDocument && pickElement.ownerDocument !== ownerDocument) {
      continue;
    }
    return {
      camera: viewport.getCamera(),
      pickElement,
    };
  }
  return null;
}

/**
 * Resolves the last pointer client position for a document.
 *
 * @param deps Layout services.
 * @param ownerDocument Document that owns the sample, or null for main.
 * @returns Client coordinates, or null.
 */
export function resolveLastPointerClientPosition(
  deps: LayoutToolEditorSetupDeps,
  ownerDocument?: Document | null,
): { clientX: number; clientY: number } | null {
  if (!ownerDocument || ownerDocument === document) {
    return deps.inputManager.getLastPointerClientPosition();
  }
  return deps.getLastPointerClientPositionForDocument?.(ownerDocument) ?? null;
}

/**
 * Builds the permanent component gizmo bridge for Edit Mode.
 *
 * @param deps Layout services.
 * @param getPointerOwnerDocument Document that owns the last pointer sample.
 * @returns Component transform interaction bridge.
 */
export function createComponentTransformBridge(
  deps: LayoutToolEditorSetupDeps,
  getPointerOwnerDocument: () => Document | null,
): BridgeComponentTransformInteraction {
  return new BridgeComponentTransformInteraction({
    transformGizmo: deps.transformGizmo,
    componentTransformHandler: deps.componentTransformHandler,
    gridSnap: deps.gridSnap,
    inputManager: deps.inputManager,
    getUserSnapEnabled: deps.getUserSnapEnabled,
    getEditModeCoordinator: () => deps.getEditModeCoordinator?.() ?? null,
    probeViewportAtClientPoint: (clientX, clientY) =>
      resolveInteractiveViewportObjectAtClientPoint(deps, clientX, clientY, getPointerOwnerDocument()),
    onPermanentGizmoHandleDragBegan: () => deps.onPermanentGizmoHandleDragBegan?.(),
    onPermanentGizmoHandleDragEnded: () => deps.onPermanentGizmoHandleDragEnded?.(),
    onLiveComponentTransform: () => deps.refreshGizmoPresentation(),
    onAfterComponentTransformCommit: () => deps.refreshGizmoPresentation(),
  });
}

/**
 * Finds the interactive viewport whose content element contains a client point.
 *
 * @param deps Layout services.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @param ownerDocument Optional document that owns the client coordinates.
 * @returns Viewport under the pointer, or null.
 */
function resolveInteractiveViewportObjectAtClientPoint(
  deps: LayoutToolEditorSetupDeps,
  clientX: number,
  clientY: number,
  ownerDocument: Document | null = null,
): Viewport3D | Viewport2D | null {
  return findInteractiveViewportAtClientPoint(deps, clientX, clientY, ownerDocument);
}

/**
 * Starts a single-use drag with gizmos hidden (Shape Editor / Blender: no
 * transform widgets during G/R/S).
 *
 * @param deps Layout services.
 * @param inputBridge Input bridge for exclusive viewport pin.
 * @param mode Transform mode.
 * @param objects Drag targets.
 * @param pivot World pivot.
 * @param camera Active camera.
 * @param pickElement Pick element.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @returns True when the drag started.
 */
export function beginSingleUseDragHiddenGizmo(
  deps: LayoutToolEditorSetupDeps,
  inputBridge: EditorInputBridge,
  mode: TransformMode,
  objects: THREE.Object3D[],
  pivot: THREE.Vector3,
  camera: THREE.Camera,
  pickElement: HTMLElement,
  clientX: number,
  clientY: number,
): boolean {
  inputBridge.setExclusiveViewportRoots(collectInteractivePickElements(deps));
  syncSingleUseSnapFromShift(deps);
  const started = deps.transformHandler.beginSingleUseDrag(mode, objects, pivot, camera, pickElement, clientX, clientY);
  if (started) {
    deps.transformGizmo.setVisible(false);
  }
  return started;
}

/**
 * Starts a component single-use drag when Edit Mode has a component selection.
 *
 * @param deps Layout deps.
 * @param mode Transform mode.
 * @param camera Camera.
 * @param pickElement Pick element.
 * @param clientX Pointer X.
 * @param clientY Pointer Y.
 * @returns True when a component drag started.
 */
export function tryBeginComponentSingleUseDrag(
  deps: LayoutToolEditorSetupDeps,
  mode: TransformMode,
  camera: THREE.Camera,
  pickElement: HTMLElement,
  clientX: number,
  clientY: number,
): boolean {
  const coordinator = deps.getEditModeCoordinator?.() ?? null;
  if (!coordinator?.isActive()) {
    return false;
  }
  const session = coordinator.getSession();
  const vertices = expandComponentSelectionToTransformVertices(
    session.getComponentSelection().getSelected(),
    session.getDomain(),
  );
  const pivot = computeComponentTransformPivot(vertices);
  if (!pivot) {
    return false;
  }
  deps.componentTransformHandler.setAfterCommitCallback(() => {
    coordinator.refreshDomainGeometryPresentation();
    deps.refreshGizmoPresentation();
  });
  deps.componentTransformHandler.setAfterLiveCallback(() => {
    coordinator.refreshDomainGeometryPresentation(true);
    deps.refreshGizmoPresentation();
  });
  deps.componentTransformHandler.setStatusCallback((text) => {
    if (text.length === 0) {
      return;
    }
    deps.setStatusMessage(text);
  });
  syncSingleUseSnapFromShift(deps);
  return deps.componentTransformHandler.beginSingleUseDrag(
    mode,
    vertices,
    pivot,
    camera,
    pickElement,
    clientX,
    clientY,
  );
}

/**
 * Returns the unlocked object selection length, or the component selection
 * count when edit mode is active.
 *
 * @param deps Layout services providing selection and optional edit-mode
 *   coordinator.
 * @returns Selection count.
 */
export function resolveEditorSelectedCount(deps: LayoutToolEditorSetupDeps): number {
  const coordinator = deps.getEditModeCoordinator?.() ?? null;
  if (coordinator?.isActive()) {
    return coordinator.getComponentSelectionCount();
  }
  return filterUnlockedObjects(deps.selectionManager.getAllSelectedObjectsAsArray()).length;
}

/**
 * Returns the transform pivot for tools and gizmos.
 *
 * @param deps Layout deps.
 * @returns World pivot.
 */
export function resolveEditorTransformPivot(deps: LayoutToolEditorSetupDeps): THREE.Vector3 {
  const coordinator = deps.getEditModeCoordinator?.() ?? null;
  if (coordinator?.isActive()) {
    const session = coordinator.getSession();
    const vertices = expandComponentSelectionToTransformVertices(
      session.getComponentSelection().getSelected(),
      session.getDomain(),
    );
    const pivot = computeComponentTransformPivot(vertices);
    if (pivot) {
      return pivot;
    }
  }
  return deps.getTransformPivot();
}

/**
 * Applies a live single-use pointer move sample.
 *
 * @param deps Layout services.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @param camera Camera for projection.
 * @param pickElement Pick element for NDC.
 */
export function applySingleUsePointerMove(
  deps: LayoutToolEditorSetupDeps,
  clientX: number,
  clientY: number,
  camera: THREE.Camera,
  pickElement: HTMLElement,
): void {
  if (!deps.transformHandler.isDragging()) {
    return;
  }
  syncSingleUseSnapFromShift(deps);
  const selection = resolveSingleUseSelection(deps);
  const pivot = deps.getTransformPivot();
  const synthetic = {
    clientX,
    clientY,
    preventDefault: () => {},
    stopPropagation: () => {},
  } as unknown as MouseEvent;
  deps.transformHandler.onPointerMove(camera, pickElement, synthetic, pivot, selection.transformTargets);
  publishLiveTransformVisuals(deps, selection);
}

/**
 * Applies Shift precision snap disable for the current single-use sample from
 * live InputManager Shift state (not sticky state from a prior parent drag).
 *
 * @param deps Layout services with grid snap and input.
 */
export function syncSingleUseSnapFromShift(deps: LayoutToolEditorSetupDeps): void {
  applyGridSnapPrecisionFromShift(deps.gridSnap, deps.inputManager.isShiftDown(), deps.getUserSnapEnabled());
}

/**
 * Restores the user snap preference after single-use commit or cancel.
 *
 * @param deps Layout services with grid snap.
 */
export function restoreSingleUseSnapUserPreference(deps: LayoutToolEditorSetupDeps): void {
  restoreGridSnapUserPreference(deps.gridSnap, deps.getUserSnapEnabled());
}

/**
 * Routes modal transform keys (axis lock, numeric typing) and refreshes solid
 * geometry / overlays with the same live path as pointer moves. Component
 * single-use G/R/S in Edit Mode uses the same X/Y/Z and math entry as object
 * tools.
 *
 * @param deps Layout services.
 * @param event Browser keyboard event.
 * @returns True when the modal controller consumed the key.
 */
export function handleModalKeyDownWithLiveVisuals(deps: LayoutToolEditorSetupDeps, event: KeyboardEvent): boolean {
  if (deps.componentTransformHandler.isDragging()) {
    return handleComponentModalKeyDownWithLiveVisuals(deps, event);
  }
  const handled = deps.transformHandler.handleModalKeyDown(event);
  if (!shouldPublishLiveVisualsAfterModalKey(handled, deps.transformHandler.isDragging())) {
    return handled;
  }
  publishLiveTransformVisuals(deps, resolveSingleUseSelection(deps));
  return true;
}

/**
 * Routes modal keys during Edit Mode component transform and refreshes the cage
 * / wireframe suppress after the pose sample.
 *
 * @param deps Layout services.
 * @param event Browser keyboard event.
 * @returns True when the component modal controller consumed the key.
 */
function handleComponentModalKeyDownWithLiveVisuals(deps: LayoutToolEditorSetupDeps, event: KeyboardEvent): boolean {
  const handled = deps.componentTransformHandler.handleModalKeyDown(event);
  if (!handled) {
    return false;
  }
  deps.getEditModeCoordinator?.()?.refreshDomainGeometryPresentation(true);
  deps.refreshGizmoPresentation();
  return true;
}

/**
 * Publishes live solid CSG, outline sync, and ruler feedback after a pose
 * sample (pointer or modal keyboard).
 *
 * @param deps Layout services.
 * @param selection Current unlocked selection snapshot.
 */
function publishLiveTransformVisuals(deps: LayoutToolEditorSetupDeps, selection: SingleUseSelectionSnapshot): void {
  publishLayoutTransformLiveVisuals(deps, selection);
}

/** Selection and transform targets for a single-use pointer sample. */
interface SingleUseSelectionSnapshot {
  selectedMeshes: THREE.Mesh[];
  transformTargets: THREE.Object3D[];
}

/**
 * Resolves unlocked selection meshes and gizmo-style transform targets.
 *
 * @param deps Layout services.
 * @returns Selection snapshot for live move or commit.
 */
function resolveSingleUseSelection(deps: LayoutToolEditorSetupDeps): SingleUseSelectionSnapshot {
  const selectedMeshes = filterUnlockedObjects(deps.selectionManager.getAllSelectedObjectsAsArray());
  const transformTargets = resolveTransformTargets(selectedMeshes, deps.selectionManager.getInspectorObjects());
  return { selectedMeshes, transformTargets };
}

/**
 * Visual refresh after modal Enter/Escape commit or cancel for permanent gizmo
 * drags.
 *
 * @param deps Layout services.
 */
export function wireAfterDragVisualRefresh(deps: LayoutToolEditorSetupDeps): void {
  deps.transformHandler.setAfterDragVisualsCallback((objects) => {
    deps.onAfterTransformCommit(objects);
  });
}
