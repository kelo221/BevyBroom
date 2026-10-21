import * as THREE from 'three';
import { ObjectDragSession } from '@/tools/object_drag/object_drag_session.js';
import type { ObjectDragPointerSample } from '@/tools/object_drag/object_drag_pointer_sample.js';
import type { ObjectDragViewport } from '@/tools/object_drag/object_drag_viewport.js';
import type { ObjectDragGridFrame } from '@/tools/object_drag/object_drag_grid_frame.js';
import {
  objectDragRayLineClosestParameter,
  objectDragRayPlaneIntersect,
} from '@/tools/object_drag/object_drag_ray_math.js';
import {
  shapeDrawBoxFromFootprint,
  shapeDrawBoxFromViewRectangle,
  shapeDrawBoxHasVolume,
  shapeDrawDominantAxis,
  type ShapeDrawAxis,
} from './shape_draw_bounds_math.js';
import { shapeDrawStartPointResolve, type ShapeDrawStartPoint } from './shape_draw_start_point.js';
import { ShapeDrawPreview, type ShapeDrawPreviewHost } from './shape_draw_preview.js';
import { shapeDrawWorldBoxFromLocal } from './shape_draw_world_box.js';
import type { ShapeDrawBrushCommit } from './shape_draw_brush_commit.js';

/** Editor systems a shape draw session works with. */
export interface ShapeDrawSessionDeps {
  /** Viewport under the drag. */
  viewport: ObjectDragViewport;
  /** Working grid frame the box aligns to. */
  gridFrame: ObjectDragGridFrame;
  /**
   * Returns the user's grid snap preference.
   *
   * @returns True when the box snaps to grid lines.
   */
  snapEnabledRead: () => boolean;
  /**
   * Returns the world bounds 2D drags take their depth from.
   *
   * @returns World box.
   */
  referenceBoundsResolve: () => THREE.Box3;
  /** Helper scene hosting the preview wireframe. */
  previewHost: ShapeDrawPreviewHost;
  /** Commits the final box as a brush. */
  brushCommit: ShapeDrawBrushCommit;
}

/** Depth axis and range of a 2D view drag. */
interface ShapeDrawViewDepth {
  axis: ShapeDrawAxis;
  minimum: number;
  maximum: number;
}

/**
 * Draws a new box brush by dragging. The perspective view drags a footprint on
 * the horizontal plane through the start (Shift squares it, Alt adjusts the
 * height); 2D views drag the visible rectangle and take the depth from the
 * reference bounds (Shift makes the sides equal).
 */
export class ShapeDrawSession extends ObjectDragSession {
  private readonly deps: ShapeDrawSessionDeps;
  private readonly start: ShapeDrawStartPoint;
  private readonly cornerLocal: THREE.Vector3;
  private heightLocal: number | null = null;
  private readonly viewDepth: ShapeDrawViewDepth | null;
  private readonly preview: ShapeDrawPreview;
  private localBox: THREE.Box3 | null = null;

  /**
   * Starts a draw session at the press point.
   *
   * @param deps Editor systems for the session.
   * @param pressClientX Press client X.
   * @param pressClientY Press client Y.
   */
  constructor(deps: ShapeDrawSessionDeps, pressClientX: number, pressClientY: number) {
    super();
    this.deps = deps;
    this.start = shapeDrawStartPointResolve(deps.viewport, deps.gridFrame, pressClientX, pressClientY);
    this.cornerLocal = this.start.startLocal.clone();
    this.viewDepth = deps.viewport.isPerspective() ? null : this.viewDepthResolve();
    this.preview = new ShapeDrawPreview(deps.previewHost);
  }

  /**
   * Returns the box the session would commit, in grid-local coordinates.
   *
   * @returns Copy of the current local box, or null before the first update.
   */
  currentLocalBox(): THREE.Box3 | null {
    return this.localBox ? this.localBox.clone() : null;
  }

  /**
   * Returns the preview wireframe object.
   *
   * @returns Preview object.
   */
  previewObject(): THREE.Object3D {
    return this.preview.previewObject();
  }

  /**
   * Updates the box from the pointer and refreshes the preview.
   *
   * @param sample Current pointer position and modifier keys.
   */
  protected sessionUpdate(sample: ObjectDragPointerSample): void {
    const ray = this.deps.viewport.rayAtClientPoint(sample.clientX, sample.clientY);
    this.localBox = this.viewDepth
      ? this.viewBoxUpdate(ray, sample, this.viewDepth)
      : this.footprintBoxUpdate(ray, sample);
    this.preview.previewShow(shapeDrawWorldBoxFromLocal(this.localBox, this.deps.gridFrame));
  }

  /** Creates the brush when the box has volume and removes the preview. */
  protected sessionCommit(): void {
    this.preview.dispose();
    if (!this.localBox || !shapeDrawBoxHasVolume(this.localBox)) {
      return;
    }
    this.deps.brushCommit.brushCommit(shapeDrawWorldBoxFromLocal(this.localBox, this.deps.gridFrame));
  }

  /** Removes the preview without creating anything. */
  protected sessionCancel(): void {
    this.preview.dispose();
  }

  /**
   * Updates the perspective footprint (or height while Alt is held) and builds
   * the box.
   *
   * @param ray Pick ray through the pointer.
   * @param sample Current pointer sample.
   * @returns New local box.
   */
  private footprintBoxUpdate(ray: THREE.Ray, sample: ObjectDragPointerSample): THREE.Box3 {
    if (sample.altKey) {
      this.heightFromRayUpdate(ray);
    } else {
      this.cornerFromRayUpdate(ray);
    }
    return shapeDrawBoxFromFootprint({
      startLocal: this.start.startLocal,
      cornerLocal: this.cornerLocal,
      heightLocal: this.heightLocal,
      squareFootprint: sample.shiftKey,
      gridStep: this.deps.gridFrame.gridStep(),
      snapEnabled: this.deps.snapEnabledRead(),
      growDirectionLocal: this.start.growDirectionLocal,
    });
  }

  /**
   * Moves the footprint corner to where the ray meets the horizontal plane
   * through the start, ignoring hits behind the camera.
   *
   * @param ray Pick ray through the pointer.
   */
  private cornerFromRayUpdate(ray: THREE.Ray): void {
    const planePoint = this.deps.gridFrame.positionToWorld(this.start.startLocal);
    const hit = objectDragRayPlaneIntersect(ray, planePoint, this.deps.gridFrame.normalWorld());
    if (!hit || hit.clone().sub(ray.origin).dot(ray.direction) <= 0) {
      return;
    }
    const hitLocal = this.deps.gridFrame.positionToLocal(hit);
    this.cornerLocal.set(hitLocal.x, this.start.startLocal.y, hitLocal.z);
  }

  /**
   * Sets the box height from the point on the vertical line through the
   * footprint corner that is closest to the ray.
   *
   * @param ray Pick ray through the pointer.
   */
  private heightFromRayUpdate(ray: THREE.Ray): void {
    const linePoint = this.deps.gridFrame.positionToWorld(this.cornerLocal);
    const parameter = objectDragRayLineClosestParameter(ray, linePoint, this.deps.gridFrame.normalWorld());
    if (parameter === null) {
      return;
    }
    this.heightLocal = this.start.startLocal.y + parameter;
  }

  /**
   * Updates the 2D view corner and builds the box with the view depth.
   *
   * @param ray Pick ray through the pointer.
   * @param sample Current pointer sample.
   * @param viewDepth Depth axis and range.
   * @returns New local box.
   */
  private viewBoxUpdate(ray: THREE.Ray, sample: ObjectDragPointerSample, viewDepth: ShapeDrawViewDepth): THREE.Box3 {
    this.cornerLocal.copy(this.deps.gridFrame.positionToLocal(ray.origin));
    return shapeDrawBoxFromViewRectangle({
      startLocal: this.start.startLocal,
      cornerLocal: this.cornerLocal,
      depthAxis: viewDepth.axis,
      depthMin: viewDepth.minimum,
      depthMax: viewDepth.maximum,
      equalSides: sample.shiftKey,
      gridStep: this.deps.gridFrame.gridStep(),
      snapEnabled: this.deps.snapEnabledRead(),
    });
  }

  /**
   * Resolves the 2D depth axis from the camera and its range from the reference
   * bounds.
   *
   * @returns Depth axis and local range.
   */
  private viewDepthResolve(): ShapeDrawViewDepth {
    const forwardLocal = this.deps.gridFrame.vectorToLocal(this.deps.viewport.cameraForwardWorld());
    const axis = shapeDrawDominantAxis(forwardLocal);
    const referenceBounds = this.deps.referenceBoundsResolve();
    let minimum = Infinity;
    let maximum = -Infinity;
    for (const corner of this.boxCorners(referenceBounds)) {
      const cornerLocal = this.deps.gridFrame.positionToLocal(corner);
      minimum = Math.min(minimum, cornerLocal[axis]);
      maximum = Math.max(maximum, cornerLocal[axis]);
    }
    return { axis, minimum, maximum };
  }

  /**
   * Lists the eight corners of a box.
   *
   * @param box Non-empty box.
   * @returns Corner points.
   */
  private boxCorners(box: THREE.Box3): THREE.Vector3[] {
    const corners: THREE.Vector3[] = [];
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          corners.push(new THREE.Vector3(x, y, z));
        }
      }
    }
    return corners;
  }
}
