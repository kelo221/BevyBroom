import * as THREE from 'three';
import { buildPlaneFromPlacementPoints } from '@/csg/csg_plane_from_points.js';
import { ClipPlanePlacementHint, resolveClipPlaneDepthAxis } from './clip_plane_depth_axis.js';
import { ClipKeepMode, clipKeepModeLabel, clipKeepModeNext } from './clip_keep_mode.js';

/** Interactive state for placing a 2–3 point clipping plane. */
export class ToolClipPlane {
  private active: boolean;
  private points: THREE.Vector3[];
  private plane: THREE.Plane | null;
  private keepMode: ClipKeepMode;
  private depthAxis: THREE.Vector3 | null;
  private hoverPoint: THREE.Vector3 | null;
  private hoverPlane: THREE.Plane | null;
  private changeCallback: (() => void) | null;
  private previewChangeCallback: (() => void) | null;

  /** Creates an inactive clip plane tool. */
  constructor() {
    this.active = false;
    this.points = [];
    this.plane = null;
    this.keepMode = ClipKeepMode.SIDE_A;
    this.depthAxis = null;
    this.hoverPoint = null;
    this.hoverPlane = null;
    this.changeCallback = null;
    this.previewChangeCallback = null;
  }

  /**
   * Registers a callback invoked when points, plane or keep mode change.
   *
   * @param callback Change listener.
   */
  setChangeCallback(callback: (() => void) | null): void {
    this.changeCallback = callback;
  }

  /**
   * Registers a callback invoked when only the pointer preview (the point under
   * the pointer while placing point 2) changes.
   *
   * @param callback Preview change listener.
   */
  setPreviewChangeCallback(callback: (() => void) | null): void {
    this.previewChangeCallback = callback;
  }

  /**
   * Returns whether the tool is active.
   *
   * @returns True when placing or ready to commit.
   */
  isActive(): boolean {
    return this.active;
  }

  /** Activates the tool and clears previous points. */
  activate(): void {
    this.active = true;
    this.clearPlacement();
    this.notifyChange();
  }

  /**
   * Deactivates an active tool and clears placement. Does nothing when the tool
   * is already inactive.
   */
  deactivate(): void {
    if (!this.active) return;
    this.active = false;
    this.clearPlacement();
    this.notifyChange();
  }

  /**
   * Adds a world-space placement point (up to three). With two points the plane
   * is view- or surface-aware via the placement hint. A third point unlocks
   * free orientation and drops depth awareness. Clears the pointer preview.
   *
   * @param point World point to add.
   * @param placementHint Optional camera/surface context for two-point planes.
   * @returns True when the point was accepted.
   */
  addPoint(point: THREE.Vector3, placementHint?: ClipPlanePlacementHint | null): boolean {
    if (!this.active) return false;
    if (this.points.length >= 3) {
      this.beginNewPlacementFromPoint(point, placementHint);
    } else {
      this.appendPlacementPoint(point, placementHint);
    }
    this.hoverClear();
    this.rebuildPlane();
    this.notifyChange();
    return true;
  }

  /**
   * Moves an existing placement point and rebuilds the plane. Keeps the locked
   * two-point depth axis so drags stay stable.
   *
   * @param index Zero-based point index.
   * @param point New world position.
   * @returns True when the point was updated.
   */
  setPoint(index: number, point: THREE.Vector3): boolean {
    if (!this.active) return false;
    const target = this.points[index];
    if (!target) return false;
    target.copy(point);
    this.rebuildPlane();
    this.notifyChange();
    return true;
  }

  /**
   * Returns which pieces the next clip keeps.
   *
   * @returns Current keep mode.
   */
  keepModeRead(): ClipKeepMode {
    return this.keepMode;
  }

  /**
   * Chooses which pieces the next clip keeps.
   *
   * @param mode Keep mode to use.
   */
  keepModeSet(mode: ClipKeepMode): void {
    if (!this.active || this.keepMode === mode) return;
    this.keepMode = mode;
    this.notifyChange();
  }

  /** Moves to the next keep mode: Side A, Side B, Both, then Side A again. */
  keepModeCycle(): void {
    this.keepModeSet(clipKeepModeNext(this.keepMode));
  }

  /**
   * Shows the cut a second point under the pointer would make while exactly one
   * point is placed. Passing null, or any call with another point count, clears
   * the pointer preview.
   *
   * @param point World point under the pointer, or null.
   * @param placementHint Optional camera/surface context of the pointer pick.
   */
  hoverPointSet(point: THREE.Vector3 | null, placementHint?: ClipPlanePlacementHint | null): void {
    if (!this.active) return;
    const first = this.points[0];
    if (!point || !first || this.points.length !== 1) {
      this.hoverClearAndNotify();
      return;
    }
    this.hoverPoint = point.clone();
    this.hoverPlane = buildPlaneFromPlacementPoints(
      [first, this.hoverPoint],
      this.depthAxisForSecondPoint(placementHint),
    );
    this.previewChangeCallback?.();
  }

  /**
   * Returns the pointer preview point while placing point 2.
   *
   * @returns Copy of the preview point, or null.
   */
  hoverPointRead(): THREE.Vector3 | null {
    return this.hoverPoint ? this.hoverPoint.clone() : null;
  }

  /**
   * Returns the current plane when at least two points are placed.
   *
   * @returns Plane or null.
   */
  getPlane(): THREE.Plane | null {
    return this.plane ? this.plane.clone() : null;
  }

  /**
   * Returns the plane to preview: the placed plane, or the plane through point
   * 1 and the pointer preview point.
   *
   * @returns Plane copy or null.
   */
  previewPlaneRead(): THREE.Plane | null {
    const plane = this.plane ?? this.hoverPlane;
    return plane ? plane.clone() : null;
  }

  /**
   * Returns the placed points followed by the pointer preview point when one is
   * shown.
   *
   * @returns Point copies.
   */
  previewPointsRead(): THREE.Vector3[] {
    const points = this.getPoints();
    if (this.hoverPoint) points.push(this.hoverPoint.clone());
    return points;
  }

  /**
   * Returns whether clip/split can be committed.
   *
   * @returns True when a valid plane exists.
   */
  isPlaneReady(): boolean {
    return this.plane !== null;
  }

  /**
   * Returns a copy of the placed points.
   *
   * @returns Placement points.
   */
  getPoints(): THREE.Vector3[] {
    return this.points.map((point) => point.clone());
  }

  /**
   * Returns the locked two-point depth axis when active, or null for free
   * three-point mode / incomplete placement.
   *
   * @returns Unit depth axis clone, or null.
   */
  getDepthAxis(): THREE.Vector3 | null {
    return this.depthAxis ? this.depthAxis.clone() : null;
  }

  /**
   * Returns a short status string for the UI.
   *
   * @returns Human-readable status.
   */
  getStatusMessage(): string {
    if (!this.active) return 'Clip tool inactive';
    if (this.points.length === 0) return 'Clip: click point 1, or drag a line across the brush';
    if (this.points.length === 1) return 'Clip: click point 2';
    if (!this.plane) return 'Clip: the points lie in a line, move one';
    const keeping = `Clip: keeping ${clipKeepModeLabel(this.keepMode)} · Tab cycles sides · Enter applies`;
    return this.points.length === 2 ? `${keeping} · point 3 tilts` : keeping;
  }

  /**
   * Clears points and plane while remaining active. Resets the keep mode to
   * Side A (used when activating the tool).
   */
  clearPlacement(): void {
    this.points = [];
    this.plane = null;
    this.depthAxis = null;
    this.keepMode = ClipKeepMode.SIDE_A;
    this.hoverClear();
  }

  /**
   * Clears placement points for another cut while keeping the tool active.
   * Preserves the keep mode so repeated clips stay consistent.
   */
  resetPlacementForNextCut(): void {
    if (!this.active) return;
    this.points = [];
    this.plane = null;
    this.depthAxis = null;
    this.hoverClear();
    this.notifyChange();
  }

  /** Clears the pointer preview without notifying listeners. */
  private hoverClear(): void {
    this.hoverPoint = null;
    this.hoverPlane = null;
  }

  /** Clears a shown pointer preview and notifies preview listeners. */
  private hoverClearAndNotify(): void {
    if (!this.hoverPoint && !this.hoverPlane) return;
    this.hoverClear();
    this.previewChangeCallback?.();
  }

  /**
   * Starts a fresh placement sequence after three points were already set.
   *
   * @param point First point of the new sequence.
   * @param placementHint Optional depth context for later two-point lock.
   */
  private beginNewPlacementFromPoint(point: THREE.Vector3, placementHint?: ClipPlanePlacementHint | null): void {
    this.points = [point.clone()];
    this.depthAxis = null;
    this.rememberDepthHint(placementHint);
  }

  /**
   * Appends a point and locks depth when the plane becomes two-point ready.
   *
   * @param point World point to append.
   * @param placementHint Optional camera/surface context.
   */
  private appendPlacementPoint(point: THREE.Vector3, placementHint?: ClipPlanePlacementHint | null): void {
    this.points.push(point.clone());
    if (this.points.length === 1) {
      this.rememberDepthHint(placementHint);
      return;
    }
    if (this.points.length === 2) {
      this.depthAxis = this.depthAxisForSecondPoint(placementHint).clone();
      return;
    }
    this.depthAxis = null;
  }

  /**
   * Stores a provisional depth axis from the first pick so a second ground pick
   * can still cut into the brush when the first hit was on a face.
   *
   * @param placementHint Optional first-point context.
   */
  private rememberDepthHint(placementHint?: ClipPlanePlacementHint | null): void {
    if (!placementHint) return;
    this.depthAxis = resolveClipPlaneDepthAxis(placementHint);
  }

  /**
   * Returns the depth axis a second point with this hint locks. Orthographic
   * and surface picks replace the provisional first-pick axis. A perspective
   * ground/void second pick keeps the first surface axis when present so the
   * cut still slices into the brush.
   *
   * @param placementHint Optional second-point context.
   * @returns Unit depth axis (the stored axis itself when it is kept).
   */
  private depthAxisForSecondPoint(placementHint?: ClipPlanePlacementHint | null): THREE.Vector3 {
    if (!placementHint) return this.depthAxis ?? new THREE.Vector3(0, 1, 0);
    const secondHasSurface = placementHint.surfaceNormal !== null;
    if (placementHint.isOrthographic || secondHasSurface || !this.depthAxis) {
      return resolveClipPlaneDepthAxis(placementHint);
    }
    return this.depthAxis;
  }

  /** Rebuilds the plane from the current points and locked depth axis. */
  private rebuildPlane(): void {
    this.plane = buildPlaneFromPlacementPoints(this.points, this.depthAxis);
  }

  /** Notifies listeners of state changes. */
  private notifyChange(): void {
    if (this.changeCallback) {
      this.changeCallback();
    }
  }
}
