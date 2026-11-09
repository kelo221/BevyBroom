import * as THREE from 'three';
import { BoundsFace } from '@/types/bounds_face.js';
import { GizmoHandle } from '@/transform/gizmo/gizmo_handle.js';
import { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import { GizmoRaycaster } from '@/transform/gizmo/gizmo_raycaster.js';
import { TransformExecutor } from '@/transform/core/transform_executor.js';
import { cloneOrientedBounds, DataOrientedBounds, getBoundsFaceLocalNormal } from './builder_oriented_bounds.js';
import { TextureLockSettings } from '@/texture/lock/texture_lock_settings.js';
import { TransformDragSession } from '@/transform/core/session_transform_drag.js';
import { TransformProjectionMath } from '@/transform/core/transform_projection_math.js';
import type { CadViewPlane } from '@/rulers/view/cad_view_plane.js';
import { BOUNDS_DEFAULT_CURSOR, resolveBoundsResizeCursor } from './bounds_resize_cursor.js';
import { pickOrthographicSilhouetteEdgeFace } from './bounds_face_interaction.js';
import { computeSilhouetteExteriorBandWorld } from './bounds_handle_screen_size.js';
import { managerMouseCursor } from '@/input/manager_mouse_cursor.js';
import { isBoundsWidgetMode } from '@/types/transform_mode.js';
import { boundsHandleFacesFromHandleRead, pickBoundsHandleFace } from './bounds_face_pick.js';
import { boundsHandleFacesEqual, boundsHandleFacesLocalAnchorWrite } from './handle/bounds_handle_faces.js';
import { BoundsResizeApplier } from './bounds_resize_applier.js';

/** Resize handles to pick from and the pane they are picked in. */
interface BoundsResizeHandleTarget {
  /** Current gizmo handles. */
  handles: GizmoHandle[];
  /** Viewport gizmo group. */
  gizmoGroup: THREE.Group;
  /** Pane view plane ('xyz' for the perspective pane). */
  viewPlane: CadViewPlane;
}

/**
 * Bounds tool interaction: one-sided resize from 3D arrows, 2D edge squares, or
 * exterior silhouette edges, and two-sided resize from 2D corner squares (the
 * opposite corner stays fixed). Hover outlines the sides being resized and
 * dual-arrow CSS cursors follow the pull direction. Presses inside the bounds,
 * and presses on 3D arrows hidden behind the bounds box, are left to the active
 * tool.
 */
export class ControllerBoundsDrag {
  private session: TransformDragSession;
  private transformGizmo: GizmoTransform;
  private gizmoRaycaster: GizmoRaycaster;
  private textureLock: TextureLockSettings | null;
  private lastHoverCursorCss: string | null;
  private lastHoverCursorElement: HTMLElement | null;
  private readonly resizeApplier: BoundsResizeApplier;

  /**
   * Creates a bounds drag controller bound to a shared drag session.
   *
   * @param session Shared drag session state.
   * @param transformGizmo The gizmo orchestrator.
   * @param gizmoRaycaster Raycaster for handles and plane projection.
   * @param transformExecutor Executor for absolute translation and snap.
   */
  constructor(
    session: TransformDragSession,
    transformGizmo: GizmoTransform,
    gizmoRaycaster: GizmoRaycaster,
    transformExecutor: TransformExecutor,
  ) {
    this.session = session;
    this.transformGizmo = transformGizmo;
    this.gizmoRaycaster = gizmoRaycaster;
    this.textureLock = null;
    this.lastHoverCursorCss = null;
    this.lastHoverCursorElement = null;
    this.resizeApplier = new BoundsResizeApplier(session, transformExecutor);
  }

  /**
   * Sets texture lock settings used when resizing meshes.
   *
   * @param settings Shared texture lock settings, or null to disable rebake.
   */
  setTextureLockSettings(settings: TextureLockSettings | null): void {
    this.textureLock = settings;
  }

  /**
   * Starts a Bounds resize from a resize handle, else from a full 2D silhouette
   * edge.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param handles Current gizmo handles.
   * @param selectedObjects Selected meshes.
   * @param pivot Transform pivot.
   * @param gizmoGroup Viewport gizmo group.
   * @param viewPlane Active pane view plane for 2D edge picking.
   */
  beginPointerDown(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    handles: GizmoHandle[],
    selectedObjects: THREE.Object3D[],
    pivot: THREE.Vector3,
    gizmoGroup: THREE.Group,
    viewPlane: CadViewPlane = 'xyz',
  ): void {
    const handleArgs = { handles, gizmoGroup, viewPlane };
    if (this.tryBeginResizeFromHandle(camera, pickElement, event, handleArgs, selectedObjects, pivot)) {
      return;
    }
    this.tryBeginResizeFromSilhouetteEdge(camera, pickElement, event, handles, selectedObjects, pivot, viewPlane);
  }

  /**
   * Probes whether a bounds resize control is under the pointer without
   * starting a drag (handles and silhouette edges).
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param handles Current gizmo handles.
   * @param gizmoGroup Viewport gizmo group.
   * @param viewPlane Active pane view plane for orthographic silhouette edges.
   * @returns True when a handle or silhouette edge is hit.
   */
  probeControlUnderPointer(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    handles: GizmoHandle[],
    gizmoGroup: THREE.Group,
    viewPlane: CadViewPlane = 'xyz',
  ): boolean {
    if (this.pickResizeHandle(camera, pickElement, event, { handles, gizmoGroup, viewPlane })) {
      return true;
    }
    return this.pickSilhouetteEdgeFace(camera, pickElement, event, viewPlane) !== null;
  }

  /**
   * Picks the resize handle under the pointer. In the perspective pane a handle
   * hidden behind the selection box along the pick ray is skipped, so a press
   * on a visible face of the selection reaches the active tool.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param target Handles, viewport gizmo group and the pane view plane.
   * @returns Picked handle, or null.
   */
  private pickResizeHandle(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    target: BoundsResizeHandleTarget,
  ): GizmoHandle | null {
    return pickBoundsHandleFace(
      this.gizmoRaycaster,
      this.transformGizmo,
      camera,
      pickElement,
      event,
      target.handles,
      target.gizmoGroup,
      target.viewPlane,
    );
  }

  /**
   * Highlights the resize sides under the pointer and sets the dual-arrow
   * resize cursor, or the regular pointer when no resize control is hovered.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC (also receives cursor style).
   * @param event The pointer event.
   * @param handles Current gizmo handles.
   * @param gizmoGroup Viewport gizmo group.
   * @param viewPlane Active pane view plane for orthographic cursor mapping.
   */
  updateFaceHoverHighlight(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    handles: GizmoHandle[],
    gizmoGroup: THREE.Group,
    viewPlane: CadViewPlane = 'xyz',
  ): void {
    if (this.session.dragActive) return;
    const resizeFaces = this.resolveHoverResizeFaces(camera, pickElement, event, handles, gizmoGroup, viewPlane);
    this.transformGizmo.setHighlightedBoundsFaces(resizeFaces);
    this.applyHoverCursor(camera, pickElement, resizeFaces, viewPlane);
  }

  /**
   * Resolves which faces should show resize hover: handle first (two faces for
   * a corner), then fat 2D silhouette edge band.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target.
   * @param event The pointer event.
   * @param handles Current gizmo handles.
   * @param gizmoGroup Viewport gizmo group.
   * @param viewPlane Active pane view plane.
   * @returns Faces under resize hover; empty when none.
   */
  private resolveHoverResizeFaces(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    handles: GizmoHandle[],
    gizmoGroup: THREE.Group,
    viewPlane: CadViewPlane,
  ): readonly BoundsFace[] {
    const picked = this.pickResizeHandle(camera, pickElement, event, { handles, gizmoGroup, viewPlane });
    if (picked) return boundsHandleFacesFromHandleRead(picked);
    const edgeFace = this.pickSilhouetteEdgeFace(camera, pickElement, event, viewPlane);
    return edgeFace ? [edgeFace] : [];
  }

  /**
   * Re-issues the last hover cursor for the current editor frame when bounds
   * mode and oriented bounds are still active.
   */
  refreshHoverCursor(): void {
    if (!this.canRefreshHoverCursor()) {
      return;
    }
    const cursorCss = this.lastHoverCursorCss;
    const targetElement = this.lastHoverCursorElement;
    if (!cursorCss || !targetElement) {
      return;
    }
    managerMouseCursor.setMouseCursor(cursorCss, targetElement);
  }

  /**
   * Re-issues the bounds resize cursor while a handle drag is active. Uses the
   * document body so the exclusive mouse shield inherits it.
   */
  reissueActiveDragCursor(): void {
    if (!this.session.dragActive || !this.session.isBoundsResize) {
      return;
    }
    const pickElement = this.session.dragRenderer;
    const camera = this.session.dragCamera;
    if (!pickElement || !camera) {
      return;
    }
    const cursorHost = this.resolveCursorHost(pickElement);
    const cursorCss = this.resolveActiveDragCursorCss(camera);
    this.lastHoverCursorCss = cursorCss;
    this.lastHoverCursorElement = cursorHost;
    managerMouseCursor.setMouseCursor(cursorCss, cursorHost);
  }

  /**
   * Forgets the cached hover cursor so the shared cursor manager can restore
   * the default on the next frame update.
   */
  clearHoverCursorCache(): void {
    this.lastHoverCursorCss = null;
    this.lastHoverCursorElement = null;
  }

  /**
   * Returns true when the cached hover cursor may be re-issued this frame.
   *
   * @returns True when bounds mode still has live oriented bounds.
   */
  private canRefreshHoverCursor(): boolean {
    if (!isBoundsWidgetMode(this.transformGizmo.getMode())) {
      return false;
    }
    if (!this.transformGizmo.isVisible()) {
      return false;
    }
    return this.transformGizmo.getCurrentBounds() !== null;
  }

  /**
   * Resolves and requests the hover CSS cursor for handle/edge resize or the
   * default through the shared mouse cursor manager.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target.
   * @param resizeFaces Faces under a handle or edge; empty when none.
   * @param viewPlane Active pane view plane.
   */
  private applyHoverCursor(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    resizeFaces: readonly BoundsFace[],
    viewPlane: CadViewPlane,
  ): void {
    const cursorCss = this.resolveHoverCursorCss(camera, resizeFaces, viewPlane);
    const cursorHost = this.resolveCursorHost(pickElement);
    this.lastHoverCursorCss = cursorCss;
    this.lastHoverCursorElement = cursorHost;
    managerMouseCursor.setMouseCursor(cursorCss, cursorHost);
  }

  /**
   * Cursor host for window-wide cursor behavior. The busy exclusive shield uses
   * cursor:inherit, so the body must own the style.
   *
   * @param pickElement Viewport pick element used to resolve the document.
   * @returns Document body when available, otherwise the pick element.
   */
  private resolveCursorHost(pickElement: HTMLElement): HTMLElement {
    return pickElement.ownerDocument?.body ?? pickElement;
  }

  /**
   * Cursor CSS for the faces of the active bounds drag.
   *
   * @param camera Camera used when the drag began.
   * @returns CSS cursor keyword.
   */
  private resolveActiveDragCursorCss(camera: THREE.Camera): string {
    const bounds = this.session.startBounds ?? this.transformGizmo.getCurrentBounds();
    if (!bounds) {
      return BOUNDS_DEFAULT_CURSOR;
    }
    return resolveBoundsResizeCursor(this.activeDragFacesRead(), bounds, camera, 'xyz');
  }

  /**
   * Lists the faces of the active bounds drag (two for a corner drag).
   *
   * @returns Active faces; empty when no resize is active.
   */
  private activeDragFacesRead(): BoundsFace[] {
    const faces: BoundsFace[] = [];
    if (this.session.activeBoundsFace) faces.push(this.session.activeBoundsFace);
    if (this.session.secondaryBoundsFace) faces.push(this.session.secondaryBoundsFace);
    return faces;
  }

  /**
   * Chooses the CSS cursor for the current bounds hover target.
   *
   * @param camera The viewport camera.
   * @param resizeFaces Faces under a handle or edge; empty when none.
   * @param viewPlane Active pane view plane.
   * @returns CSS cursor keyword.
   */
  private resolveHoverCursorCss(
    camera: THREE.Camera,
    resizeFaces: readonly BoundsFace[],
    viewPlane: CadViewPlane,
  ): string {
    const bounds = this.transformGizmo.getCurrentBounds();
    if (!bounds) {
      return BOUNDS_DEFAULT_CURSOR;
    }
    return resolveBoundsResizeCursor(resizeFaces, bounds, camera, viewPlane);
  }

  /**
   * Dispatches resize drag updates for an active handle or edge resize.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param objects Selected meshes.
   */
  handleMove(camera: THREE.Camera, pickElement: HTMLElement, event: MouseEvent, objects: THREE.Object3D[]): void {
    if (this.session.isBoundsResize) {
      this.handleResize(camera, pickElement, event, objects);
    }
  }

  /**
   * Starts a bounds resize when an edge or corner handle is hit.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param target Handles, viewport gizmo group and the pane view plane.
   * @param selectedObjects Selected meshes.
   * @param pivot Transform pivot.
   * @returns True when a resize drag was started.
   */
  private tryBeginResizeFromHandle(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    target: BoundsResizeHandleTarget,
    selectedObjects: THREE.Object3D[],
    pivot: THREE.Vector3,
  ): boolean {
    const picked = this.pickResizeHandle(camera, pickElement, event, target);
    if (!picked) return false;
    const faces = boundsHandleFacesFromHandleRead(picked);
    if (faces.length === 0) return false;
    const bounds = this.transformGizmo.getCurrentBounds();
    if (!bounds) return false;
    this.beginResizeSession(camera, pickElement, event, selectedObjects, pivot, bounds, faces, picked);
    return true;
  }

  /**
   * Starts a one-sided resize when the pointer is near a full 2D silhouette
   * edge (fat invisible band along the whole side, not only the square).
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param handles Current handles (used to bind an optional matching handle).
   * @param selectedObjects Selected meshes.
   * @param pivot Transform pivot.
   * @param viewPlane Active orthographic plane.
   * @returns True when a resize drag was started.
   */
  private tryBeginResizeFromSilhouetteEdge(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    handles: GizmoHandle[],
    selectedObjects: THREE.Object3D[],
    pivot: THREE.Vector3,
    viewPlane: CadViewPlane,
  ): boolean {
    const face = this.pickSilhouetteEdgeFace(camera, pickElement, event, viewPlane);
    if (!face) return false;
    const bounds = this.transformGizmo.getCurrentBounds();
    if (!bounds) return false;
    const handle = this.findHandleForFaces(handles, [face]);
    this.beginResizeSession(camera, pickElement, event, selectedObjects, pivot, bounds, [face], handle);
    return true;
  }

  /**
   * Picks a silhouette edge face under the pointer in an orthographic pane.
   * Selections that may not be resized have no silhouette edges.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target.
   * @param event The pointer event.
   * @param viewPlane Active view plane.
   * @returns Bounds face for the nearest edge, or null.
   */
  private pickSilhouetteEdgeFace(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    viewPlane: CadViewPlane,
  ): BoundsFace | null {
    if (viewPlane === 'xyz' || !this.transformGizmo.isBoundsResizeAllowed()) return null;
    const bounds = this.transformGizmo.getCurrentBounds();
    if (!bounds) return null;
    const plane = TransformProjectionMath.buildCameraPlane(camera, bounds.center);
    const worldPoint = this.gizmoRaycaster.projectMouseToPlane(camera, pickElement, event, plane);
    if (!worldPoint) return null;
    const viewportHeight = Math.max(1, pickElement.clientHeight || pickElement.offsetHeight || 512);
    const exteriorBand = computeSilhouetteExteriorBandWorld(camera, viewportHeight);
    return pickOrthographicSilhouetteEdgeFace(worldPoint, bounds, viewPlane, exteriorBand);
  }

  /**
   * Finds the resize handle that drags exactly the given faces, when present.
   *
   * @param handles Active gizmo handles.
   * @param faces Target faces.
   * @returns Matching handle, or null.
   */
  private findHandleForFaces(handles: GizmoHandle[], faces: readonly BoundsFace[]): GizmoHandle | null {
    return handles.find((handle) => boundsHandleFacesEqual(boundsHandleFacesFromHandleRead(handle), faces)) ?? null;
  }

  /**
   * Captures session state and starts a resize along one face, or two faces for
   * a corner handle.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param selectedObjects Selected meshes.
   * @param pivot Transform pivot.
   * @param bounds Bounds at drag start.
   * @param faces Faces being resized (first is the active face).
   * @param handle Picked resize handle, or null when resizing via silhouette
   *   edge.
   */
  private beginResizeSession(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    selectedObjects: THREE.Object3D[],
    pivot: THREE.Vector3,
    bounds: DataOrientedBounds,
    faces: readonly BoundsFace[],
    handle: GizmoHandle | null,
  ): void {
    this.session.snapshotPreDragState(selectedObjects);
    this.session.resetDragAccumulator();
    this.resizeApplier.snapStepTrackingClear();
    this.sessionResizeStateBegin(camera, pickElement, pivot, bounds, faces, handle);
    this.transformGizmo.setActiveHandle(handle);
    this.transformGizmo.setHighlightedBoundsFaces(faces);
    this.captureResizeStart(camera, pickElement, event, bounds, faces);
    this.transformGizmo.setBoundsGuideLinesVisible(true);
    this.reissueActiveDragCursor();
  }

  /**
   * Stores the resize drag start state on the shared session.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param pivot Transform pivot.
   * @param bounds Bounds at drag start.
   * @param faces Faces being resized (first is the active face).
   * @param handle Picked resize handle, or null.
   */
  private sessionResizeStateBegin(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    pivot: THREE.Vector3,
    bounds: DataOrientedBounds,
    faces: readonly BoundsFace[],
    handle: GizmoHandle | null,
  ): void {
    this.session.dragPivot.copy(pivot);
    this.session.dragActive = true;
    this.session.isBoundsResize = true;
    this.session.activeHandle = handle;
    this.session.activeBoundsFace = faces[0] ?? null;
    this.session.secondaryBoundsFace = faces[1] ?? null;
    this.session.startBounds = cloneOrientedBounds(bounds);
    this.session.dragCamera = camera;
    this.session.dragRenderer = pickElement;
  }

  /**
   * Applies a bounds resize for the given face travels (pointer moves and modal
   * re-apply paths) and records them as the last pointer travels.
   *
   * @param objects Selected meshes.
   * @param deltaAlongNormal Displacement along the active face outward normal.
   * @param secondaryDeltaAlongNormal Displacement along the secondary (corner)
   *   face outward normal; ignored for edge drags.
   */
  applyResizeDelta(objects: THREE.Object3D[], deltaAlongNormal: number, secondaryDeltaAlongNormal: number = 0): void {
    this.session.boundsDeltaAlongNormal = deltaAlongNormal;
    this.session.lastPointerBoundsResizeDelta = deltaAlongNormal;
    this.session.lastPointerSecondaryBoundsResizeDelta = secondaryDeltaAlongNormal;
    const steps = this.resizeApplier.stepsBuild(deltaAlongNormal, secondaryDeltaAlongNormal);
    this.resizeApplier.objectsResize(objects, steps);
    this.rebakeLockedTextures(objects, true, true);
    this.resizeApplier.snapStepAudioRaiseIfStepped(steps);
  }

  /**
   * Applies the resize from the pointer: the pointer travel projected on each
   * dragged face normal, with snap.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param objects Selected meshes.
   */
  private handleResize(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    objects: THREE.Object3D[],
  ): void {
    const pointerTravel = this.pointerTravelRead(camera, pickElement, event);
    if (!pointerTravel) return;
    const primaryDelta = this.faceTravelSnapped(pointerTravel, this.session.activeBoundsFace);
    const secondaryDelta = this.faceTravelSnapped(pointerTravel, this.session.secondaryBoundsFace);
    this.applyResizeDelta(objects, primaryDelta, secondaryDelta);
  }

  /**
   * Measures the world pointer travel since the resize drag started, on the
   * camera plane through the start sample.
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @returns World travel, or null when the pointer misses the plane.
   */
  private pointerTravelRead(camera: THREE.Camera, pickElement: HTMLElement, event: MouseEvent): THREE.Vector3 | null {
    const initialMousePosition = this.session.initialMousePosition;
    if (!initialMousePosition) return null;
    const plane = TransformProjectionMath.buildCameraPlane(camera, initialMousePosition);
    const current = this.gizmoRaycaster.projectMouseToPlane(camera, pickElement, event, plane);
    return current ? current.sub(initialMousePosition) : null;
  }

  /**
   * Projects pointer travel on a face's world outward normal and snaps it.
   *
   * @param pointerTravel World pointer travel since the drag started.
   * @param face Dragged face, or null.
   * @returns Snapped travel along the face normal; zero without a face.
   */
  private faceTravelSnapped(pointerTravel: THREE.Vector3, face: BoundsFace | null): number {
    const startBounds = this.session.startBounds;
    if (!face || !startBounds) {
      return 0;
    }
    return this.resizeApplier.deltaSnap(pointerTravel.dot(this.computeFaceWorldNormal(startBounds, face)));
  }

  /**
   * Applies content texture-lock policy after a transform.
   *
   * @param objects Objects that just transformed (non-meshes ignored).
   * @param moved True when translation or rotation changed.
   * @param scaled True when scale changed.
   */
  rebakeLockedTextures(objects: THREE.Object3D[], moved: boolean = true, scaled: boolean = true): void {
    if (!this.textureLock) return;
    const meshes = objects.filter((object): object is THREE.Mesh => object instanceof THREE.Mesh);
    if (meshes.length === 0) return;
    this.textureLock.applyContentTransformPolicy(meshes, moved, scaled);
  }

  /**
   * Stores the initial mouse sample for a bounds resize drag on the camera
   * plane through the dragged face center (or corner).
   *
   * @param camera The viewport camera.
   * @param pickElement DOM pick target for NDC.
   * @param event The pointer event.
   * @param bounds Bounds at drag start.
   * @param faces Faces being resized.
   */
  private captureResizeStart(
    camera: THREE.Camera,
    pickElement: HTMLElement,
    event: MouseEvent,
    bounds: DataOrientedBounds,
    faces: readonly BoundsFace[],
  ): void {
    const localAnchor = boundsHandleFacesLocalAnchorWrite(faces, bounds.halfExtents, 0, new THREE.Vector3());
    const worldAnchor = localAnchor.applyQuaternion(bounds.quaternion).add(bounds.center);
    const plane = TransformProjectionMath.buildCameraPlane(camera, worldAnchor);
    this.session.initialMousePosition = this.gizmoRaycaster.projectMouseToPlane(camera, pickElement, event, plane);
  }

  /**
   * Computes a face outward normal in world space.
   *
   * @param bounds Oriented bounds.
   * @param face Face identifier.
   * @returns Normalized world normal.
   */
  private computeFaceWorldNormal(bounds: DataOrientedBounds, face: BoundsFace): THREE.Vector3 {
    return getBoundsFaceLocalNormal(face).applyQuaternion(bounds.quaternion).normalize();
  }
}
