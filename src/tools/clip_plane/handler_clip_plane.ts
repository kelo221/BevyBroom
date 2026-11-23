import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import type { KeyboardShortcutAction } from '@/settings/store/settings_types.js';
import type { RegistryModalToolSession } from '@/tools/session/registry_modal_tool_session.js';
import { ToolClipPlane } from './tool_clip_plane.js';
import { ClipPlanePointPicker, type ClipPlanePickResult } from './clip_plane_point_picker.js';
import { ClipPlanePointDrag } from './clip_plane_point_drag.js';
import { ClipPlanePreview, CLIP_PREVIEW_USERDATA_KEY } from './clip_plane_preview.js';
import { ClipPlanePlacementHint, createClipPlanePlacementHint } from './clip_plane_depth_axis.js';
import { ClipPlaneCommitRunner } from './clip_plane_commit_runner.js';
import { ClipPlaneLineDrag } from './clip_plane_line_drag.js';
import { ClipKeepMode, clipKeepModeLabel } from './clip_keep_mode.js';

/** Dependencies for running clip/split operations from the clip tool. */
export interface HandlerClipPlaneDependencies {
  worldObject: THREE.Group;
  commandStack: CommandStack;
  selectionManager: ManagerSelection;
  gridSnap: GridSnap;
  clipPlaneTool: ToolClipPlane;
  modalToolSessionRegistry: RegistryModalToolSession;
  showStatusMessage: (message: string) => void;
  syncPrimitivesToViewports: () => void;
  refreshOutliner: () => void;
  updateShadingMeshes: () => void;
  onToolStateChanged: () => void;
  keyboardShortcutMatches: (event: KeyboardEvent, action: KeyboardShortcutAction) => boolean;
}

/** Point under the pointer with the placement context it was picked in. */
interface ClipPlanePointerPick {
  readonly point: THREE.Vector3;
  readonly hint: ClipPlanePlacementHint;
}

/**
 * Coordinates clip plane point picking, pointer preview, line drags, marker
 * drags, keep-side cycling, keys and commits.
 */
export class HandlerClipPlane {
  private deps: HandlerClipPlaneDependencies;
  private pointPicker: ClipPlanePointPicker;
  private pointDrag: ClipPlanePointDrag;
  private preview: ClipPlanePreview;
  private commitRunner: ClipPlaneCommitRunner;
  private draggingPointIndex: number;
  private dragPlane: THREE.Plane | null;
  private dragCamera: THREE.Camera | null;
  private dragRenderer: HTMLElement | null;
  private lineDrag: ClipPlaneLineDrag | null;
  private pointerPick: ClipPlanePointerPick | null;
  private hoveredMarkerIndex: number | null;
  private placementMeshesCache: THREE.Mesh[] | null;

  /**
   * Creates a clip plane handler.
   *
   * @param deps Shared editor systems.
   */
  constructor(deps: HandlerClipPlaneDependencies) {
    this.deps = deps;
    this.pointPicker = new ClipPlanePointPicker(deps.gridSnap);
    this.pointDrag = new ClipPlanePointDrag(deps.gridSnap);
    this.preview = new ClipPlanePreview();
    this.commitRunner = new ClipPlaneCommitRunner(deps);
    this.draggingPointIndex = -1;
    this.dragPlane = null;
    this.dragCamera = null;
    this.dragRenderer = null;
    this.lineDrag = null;
    this.pointerPick = null;
    this.hoveredMarkerIndex = null;
    this.placementMeshesCache = null;
    deps.worldObject.add(this.preview.getRoot());
    this.toolListenersAttach();
  }

  /**
   * Returns the clip-plane preview instance.
   *
   * @returns Clip plane preview.
   */
  getPreview(): ClipPlanePreview {
    return this.preview;
  }

  /**
   * Re-parents the preview under the world root when needed and rebuilds
   * visuals.
   */
  reattachPreviewToWorld(): void {
    const previewRoot = this.preview.getRoot();
    if (previewRoot.parent !== this.deps.worldObject) {
      this.deps.worldObject.add(previewRoot);
    }
    this.syncPreviewFromTool();
  }

  /**
   * Handles a viewport pointer-down while the clip tool is active. Grabs
   * existing markers first; otherwise places a new point. Placing point 1
   * starts a line drag so press, drag and release places both points.
   *
   * @param event Pointer event.
   * @param camera Viewport camera.
   * @param pickElement Viewport pickElement.
   * @returns True when the event was consumed.
   */
  onPointerDown(event: MouseEvent, camera: THREE.Camera, pickElement: HTMLElement): boolean {
    if (!this.deps.clipPlaneTool.isActive()) return false;
    if (this.tryBeginMarkerDrag(event, camera, pickElement)) return true;
    this.placeNewPoint(event, camera, pickElement);
    if (this.deps.clipPlaneTool.getPoints().length === 1) {
      this.lineDrag = new ClipPlaneLineDrag(camera, pickElement, event.clientX, event.clientY);
    }
    return true;
  }

  /**
   * Returns whether a placement marker is currently being dragged.
   *
   * @returns True while a marker drag session is live.
   */
  isMarkerDragging(): boolean {
    return this.draggingPointIndex >= 0;
  }

  /**
   * Returns whether the button is held for a marker drag or a line drag.
   *
   * @returns True while pointer moves belong to a drag.
   */
  isPointerDragActive(): boolean {
    return this.isMarkerDragging() || this.lineDrag !== null;
  }

  /**
   * Continues an active line drag or marker drag for the given pointer
   * position.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @param shiftKey True when shift is held (disables snap).
   */
  onEditorPointerMove(clientX: number, clientY: number, shiftKey: boolean): void {
    if (this.lineDrag) {
      this.lineDragMove(this.lineDrag, clientX, clientY, shiftKey);
      return;
    }
    if (this.draggingPointIndex < 0 || !this.dragPlane || !this.dragCamera || !this.dragRenderer) return;
    const synthetic = this.createSyntheticMouseEvent(clientX, clientY, shiftKey);
    const point = this.pointDrag.projectOntoDragPlane(
      synthetic,
      this.dragCamera,
      this.dragRenderer,
      this.dragPlane,
      !shiftKey,
    );
    if (point) this.deps.clipPlaneTool.setPoint(this.draggingPointIndex, point);
  }

  /**
   * Ends an active line drag (placing point 2 when the pointer moved) or marker
   * drag.
   *
   * @param syncViewports Whether to refresh viewport selectables and selection
   *   visuals.
   */
  onEditorPointerUp(syncViewports: boolean = true): void {
    this.lineDragEnd();
    this.endMarkerDrag(syncViewports);
  }

  /**
   * Updates the hover feedback for a pointer move without a held button: the
   * marker under the pointer grows, and while exactly one point is placed the
   * preview shows the cut a click here would make.
   *
   * @param event Pointer event (client position and Shift state).
   * @param camera Camera of the pane under the pointer.
   * @param pickElement Pick element of that pane.
   */
  onPointerHover(event: MouseEvent, camera: THREE.Camera, pickElement: HTMLElement): void {
    const tool = this.deps.clipPlaneTool;
    if (!tool.isActive() || this.isPointerDragActive()) return;
    const points = tool.getPoints();
    this.hoveredMarkerIndexSet(this.pointDrag.pickMarkerIndex(event, camera, pickElement, points));
    if (points.length !== 1 || this.hoveredMarkerIndex !== null) {
      tool.hoverPointSet(null);
      return;
    }
    this.pointerPickUpdate(event, camera, pickElement);
  }

  /**
   * Builds a minimal mouse event carrying client coordinates and shift state.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @param shiftKey Shift modifier.
   * @returns Synthetic mouse event.
   */
  createSyntheticMouseEvent(clientX: number, clientY: number, shiftKey: boolean = false): MouseEvent {
    return {
      clientX,
      clientY,
      shiftKey,
      button: 0,
      buttons: 1,
      preventDefault: () => undefined,
      stopPropagation: () => undefined,
    } as MouseEvent;
  }

  /** Moves to the next keep mode (Side A, Side B, Both) and reports it. */
  keepModeCycle(): void {
    if (!this.deps.clipPlaneTool.isActive()) return;
    this.deps.clipPlaneTool.keepModeCycle();
    this.keepModeStatusShow();
  }

  /**
   * Chooses which pieces the clip keeps and reports it.
   *
   * @param mode Keep mode to use.
   */
  keepModeSet(mode: ClipKeepMode): void {
    if (!this.deps.clipPlaneTool.isActive()) return;
    this.deps.clipPlaneTool.keepModeSet(mode);
    this.keepModeStatusShow();
  }

  /** Applies the placed plane to the selection with the current keep mode. */
  applyCut(): void {
    const plane = this.requireReadyPlane();
    if (!plane) return;
    this.commitRunner.apply(plane, this.deps.clipPlaneTool.keepModeRead());
  }

  /**
   * Handles a key while the clip tool is active: the commit key applies the
   * cut, and the side-cycle key or the clip tool key itself cycles the keep
   * mode.
   *
   * @param event Keyboard event.
   * @returns True when the key belonged to the clip tool.
   */
  keyDownHandle(event: KeyboardEvent): boolean {
    if (!this.deps.clipPlaneTool.isActive()) return false;
    if (this.deps.keyboardShortcutMatches(event, 'clip_commit')) {
      event.preventDefault();
      this.applyCut();
      return true;
    }
    if (!this.keepModeCycleKeyIs(event)) return false;
    event.preventDefault();
    if (!event.repeat) this.keepModeCycle();
    return true;
  }

  /** Cancels placement and deactivates the tool. */
  cancel(): void {
    this.lineDrag = null;
    this.endMarkerDrag(false);
    this.deps.clipPlaneTool.deactivate();
    this.deps.showStatusMessage('Clip tool cancelled');
  }

  /** Subscribes to tool and selection changes. */
  private toolListenersAttach(): void {
    this.deps.clipPlaneTool.setChangeCallback(() => this.onToolChanged());
    this.deps.clipPlaneTool.setPreviewChangeCallback(() => this.syncPreviewFromTool());
    this.deps.selectionManager.onSelectionChanged(() => this.onSelectionChangedWhileClipActive());
  }

  /**
   * Returns whether a key cycles the keep mode.
   *
   * @param event Keyboard event.
   * @returns True for the side-cycle key and the clip tool key.
   */
  private keepModeCycleKeyIs(event: KeyboardEvent): boolean {
    return (
      this.deps.keyboardShortcutMatches(event, 'clip_side_cycle') ||
      this.deps.keyboardShortcutMatches(event, 'tool_clip')
    );
  }

  /** Shows the keep mode in the status bar. */
  private keepModeStatusShow(): void {
    const tool = this.deps.clipPlaneTool;
    const message = tool.isPlaneReady()
      ? tool.getStatusMessage()
      : `Clip: the cut keeps ${clipKeepModeLabel(tool.keepModeRead())}`;
    this.deps.showStatusMessage(message);
  }

  /**
   * Stores which marker is under the pointer and redraws when it changed.
   *
   * @param index Marker index under the pointer, or null.
   */
  private hoveredMarkerIndexSet(index: number | null): void {
    if (this.hoveredMarkerIndex === index) return;
    this.hoveredMarkerIndex = index;
    this.syncPreviewFromTool();
  }

  /**
   * Picks the point under the pointer and shows it as the pointer preview.
   *
   * @param event Pointer event.
   * @param camera Viewport camera.
   * @param pickElement Viewport pickElement.
   */
  private pointerPickUpdate(event: MouseEvent, camera: THREE.Camera, pickElement: HTMLElement): void {
    const pick = this.pickPlacementPoint(event, camera, pickElement);
    this.pointerPick = pick
      ? { point: pick.point, hint: createClipPlanePlacementHint(camera, pick.surfaceNormal) }
      : null;
    this.deps.clipPlaneTool.hoverPointSet(this.pointerPick?.point ?? null, this.pointerPick?.hint ?? null);
  }

  /**
   * Drags out point 2 of a line drag once the pointer left the press spot.
   *
   * @param lineDrag Active line drag.
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @param shiftKey True when shift is held (disables snap).
   */
  private lineDragMove(lineDrag: ClipPlaneLineDrag, clientX: number, clientY: number, shiftKey: boolean): void {
    if (!lineDrag.pointerMove(clientX, clientY)) return;
    const event = this.createSyntheticMouseEvent(clientX, clientY, shiftKey);
    this.pointerPickUpdate(event, lineDrag.camera, lineDrag.pickElement);
  }

  /** Ends a line drag and places point 2 where a real drag was released. */
  private lineDragEnd(): void {
    const lineDrag = this.lineDrag;
    this.lineDrag = null;
    if (!lineDrag?.isDragged() || !this.pointerPick) return;
    const pick = this.pointerPick;
    this.pointerPick = null;
    this.deps.clipPlaneTool.addPoint(pick.point, pick.hint);
    this.deps.showStatusMessage(this.deps.clipPlaneTool.getStatusMessage());
  }

  /**
   * Starts dragging a placement marker when the pointer is over one.
   *
   * @param event Pointer event.
   * @param camera Viewport camera.
   * @param pickElement Viewport pickElement.
   * @returns True when a drag started.
   */
  private tryBeginMarkerDrag(event: MouseEvent, camera: THREE.Camera, pickElement: HTMLElement): boolean {
    const points = this.deps.clipPlaneTool.getPoints();
    const index = this.pointDrag.pickMarkerIndex(event, camera, pickElement, points);
    const point = index === null ? undefined : points[index];
    if (index === null || !point) return false;
    this.beginMarkerDrag(index, point, camera, pickElement);
    return true;
  }

  /**
   * Begins a marker drag session for one placement point.
   *
   * @param index Placement point index.
   * @param point Starting world position.
   * @param camera Viewport camera.
   * @param pickElement Viewport pickElement.
   */
  private beginMarkerDrag(index: number, point: THREE.Vector3, camera: THREE.Camera, pickElement: HTMLElement): void {
    this.endMarkerDrag(false);
    this.draggingPointIndex = index;
    this.dragPlane = this.pointDrag.createDragPlane(point, camera);
    this.dragCamera = camera;
    this.dragRenderer = pickElement;
    this.deps.showStatusMessage(`Dragging clip point ${index + 1}`);
  }

  /**
   * Ends an active marker drag and optionally refreshes viewport visuals.
   *
   * @param syncViewports Whether to refresh viewport selectables and selection
   *   visuals.
   */
  private endMarkerDrag(syncViewports: boolean): void {
    const wasDragging = this.draggingPointIndex >= 0;
    this.draggingPointIndex = -1;
    this.dragPlane = null;
    this.dragCamera = null;
    this.dragRenderer = null;
    if (wasDragging && syncViewports) {
      this.deps.syncPrimitivesToViewports();
      this.deps.showStatusMessage(this.deps.clipPlaneTool.getStatusMessage());
    }
  }

  /**
   * Places a new clip point from a view-plane, mesh or ground hit.
   *
   * @param event Pointer event.
   * @param camera Viewport camera.
   * @param pickElement Viewport pickElement.
   */
  private placeNewPoint(event: MouseEvent, camera: THREE.Camera, pickElement: HTMLElement): void {
    const pick = this.pickPlacementPoint(event, camera, pickElement);
    if (!pick) {
      this.deps.showStatusMessage('Click a mesh or the ground plane');
      return;
    }
    const placementHint = createClipPlanePlacementHint(camera, pick.surfaceNormal);
    this.deps.clipPlaneTool.addPoint(pick.point, placementHint);
    this.deps.showStatusMessage(this.deps.clipPlaneTool.getStatusMessage());
  }

  /**
   * Picks a placement point under the pointer.
   *
   * @param event Pointer event.
   * @param camera Viewport camera.
   * @param pickElement Viewport pickElement.
   * @returns Pick result, or null when nothing was hit.
   */
  private pickPlacementPoint(
    event: MouseEvent,
    camera: THREE.Camera,
    pickElement: HTMLElement,
  ): ClipPlanePickResult | null {
    return this.pointPicker.pickPoint(
      event,
      camera,
      pickElement,
      this.placementMeshesRead(),
      this.viewPlaneAnchorRead(),
    );
  }

  /**
   * Returns the point 2D view picks pass through: the selection center, else
   * point 1, else the world origin.
   *
   * @returns World anchor point.
   */
  private viewPlaneAnchorRead(): THREE.Vector3 {
    const bounds = new THREE.Box3();
    this.collectClipPreviewTargets().forEach((mesh) => bounds.expandByObject(mesh));
    if (!bounds.isEmpty()) return bounds.getCenter(new THREE.Vector3());
    return this.deps.clipPlaneTool.getPoints()[0] ?? new THREE.Vector3();
  }

  /** Syncs preview visuals after tool state changes. */
  private onToolChanged(): void {
    this.placementMeshesCache = null;
    this.syncPreviewFromTool();
    this.deps.onToolStateChanged();
    if (this.draggingPointIndex < 0) {
      this.deps.syncPrimitivesToViewports();
    }
  }

  /**
   * Syncs the clip preview when the tool is active; returns immediately when
   * inactive.
   */
  private onSelectionChangedWhileClipActive(): void {
    if (!this.deps.clipPlaneTool.isActive()) return;
    this.placementMeshesCache = null;
    this.syncPreviewFromTool();
  }

  /**
   * Rebuilds clip preview markers, sheet, pieces and arrows from the tool and
   * the current selected mesh targets.
   */
  private syncPreviewFromTool(): void {
    this.preview.syncFromTool(this.deps.clipPlaneTool, this.collectClipPreviewTargets(), this.hoveredMarkerIndex);
  }

  /**
   * Returns selected meshes that are not clip-plane preview objects.
   *
   * @returns Selected mesh targets.
   */
  private collectClipPreviewTargets(): THREE.Mesh[] {
    return this.deps.selectionManager.getAllSelectedObjectsAsArray().filter((object) => {
      return object instanceof THREE.Mesh && !this.isClipPreviewObject(object);
    });
  }

  /**
   * Returns a ready plane or shows status and null.
   *
   * @returns Plane or null.
   */
  private requireReadyPlane(): THREE.Plane | null {
    const plane = this.deps.clipPlaneTool.getPlane();
    if (!plane) {
      this.deps.showStatusMessage('Place at least two points first');
      return null;
    }
    return plane;
  }

  /**
   * Returns the meshes points can be placed on, collected once per placement
   * step so pointer moves do not walk the whole world each time.
   *
   * @returns Mesh list.
   */
  private placementMeshesRead(): THREE.Mesh[] {
    if (!this.placementMeshesCache) this.placementMeshesCache = this.collectWorldMeshes();
    return this.placementMeshesCache;
  }

  /**
   * Collects mesh children of the world object, excluding clip-plane preview
   * objects.
   *
   * @returns Mesh list.
   */
  private collectWorldMeshes(): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    this.deps.worldObject.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (this.isClipPreviewObject(child)) return;
      meshes.push(child);
    });
    return meshes;
  }

  /**
   * Returns whether the object or any ancestor carries clip-plane preview
   * userdata.
   *
   * @param object Candidate object to test.
   * @returns True when clip-plane preview userdata is found on the object or an
   *   ancestor.
   */
  private isClipPreviewObject(object: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current.userData[CLIP_PREVIEW_USERDATA_KEY] === true) return true;
      current = current.parent;
    }
    return false;
  }
}
