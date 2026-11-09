import * as THREE from 'three';
import type { GridSnap } from '@/transform/snap/grid_snap.js';
import { ObjectDragViewport, type ObjectDragViewportSource } from '@/tools/object_drag/object_drag_viewport.js';
import type { PolygonExtrusionFrame } from '../polygon_convex_decomposer.js';
import { PolygonSketchFrame } from './polygon_sketch_frame.js';

/** A pointer position mapped onto a Polygon sketch plane. */
export interface PolygonSketchHit {
  /** 2D sketch coordinate on the plane. */
  point: THREE.Vector2;
  /** Frame of the plane the point lies on. */
  frame: PolygonExtrusionFrame;
}

/**
 * Maps a client point onto a Polygon sketch plane. Without a locked frame the
 * plane is chosen from the view under the pointer.
 */
export type PolygonSketchClientProjector = (
  clientX: number,
  clientY: number,
  lockedFrame: PolygonExtrusionFrame | null,
  depth: number,
) => PolygonSketchHit | null;

/** Editor systems the sketch projector reads. */
export interface PolygonSketchProjectorDeps {
  /**
   * Finds the interactive viewport under a client point.
   *
   * @param clientX Client X.
   * @param clientY Client Y.
   * @returns Viewport, or null when the point is outside every pane.
   */
  viewportAtClientPoint: (clientX: number, clientY: number) => ObjectDragViewportSource | null;
  /** Live grid snap holding the working grid plane and snap step. */
  gridSnap: GridSnap;
}

/**
 * Projects pointer positions onto the Polygon sketch plane: a 2D view sketches
 * on the plane facing its camera through the grid origin, the 3D view sketches
 * on the working grid plane. Points snap to the grid while snapping is on.
 */
export class PolygonSketchProjector {
  private readonly deps: PolygonSketchProjectorDeps;

  /**
   * Creates a sketch projector.
   *
   * @param deps Viewport lookup and grid snap.
   */
  constructor(deps: PolygonSketchProjectorDeps) {
    this.deps = deps;
  }

  /**
   * Maps a client point onto the locked frame, or onto the frame of the view
   * under the pointer when no frame is locked.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @param lockedFrame Frame of an outline in progress, or null.
   * @param depth Extrusion depth for a newly chosen frame.
   * @returns Sketch hit, or null when no view is under the pointer or the ray
   *   misses the plane.
   */
  project(
    clientX: number,
    clientY: number,
    lockedFrame: PolygonExtrusionFrame | null,
    depth: number,
  ): PolygonSketchHit | null {
    const source = this.deps.viewportAtClientPoint(clientX, clientY);
    if (!source) {
      return null;
    }
    const viewport = new ObjectDragViewport(source);
    const frame = lockedFrame ?? this.frameForViewport(viewport, depth);
    const ray = viewport.rayAtClientPoint(clientX, clientY);
    const point = PolygonSketchFrame.pointOnPlane(ray, frame, this.snapStepRead(), !viewport.isPerspective());
    return point ? { point, frame } : null;
  }

  /**
   * Chooses the sketch frame of a view: the working grid plane for the 3D view,
   * the plane facing the camera for 2D views.
   *
   * @param viewport Viewport under the pointer.
   * @param depth Extrusion depth.
   * @returns New sketch frame.
   */
  private frameForViewport(viewport: ObjectDragViewport, depth: number): PolygonExtrusionFrame {
    const gridPlane = this.deps.gridSnap.getPlaneFrame();
    if (viewport.isPerspective()) {
      return PolygonSketchFrame.fromGridPlane(gridPlane, depth);
    }
    const camera = viewport.viewportSource().getCamera();
    camera.updateMatrixWorld(false);
    const viewUp = new THREE.Vector3(0, 1, 0).transformDirection(camera.matrixWorld);
    return PolygonSketchFrame.fromView(viewport.cameraForwardWorld(), viewUp, gridPlane.origin, depth);
  }

  /**
   * Returns the snap step of placed points.
   *
   * @returns Grid interval while snapping is on, otherwise zero.
   */
  private snapStepRead(): number {
    return this.deps.gridSnap.isEnabled() ? this.deps.gridSnap.getInterval() : 0;
  }
}
