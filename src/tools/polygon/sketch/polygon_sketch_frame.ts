import * as THREE from 'three';
import type { PolygonExtrusionFrame } from '../polygon_convex_decomposer.js';

/**
 * Smallest |ray direction · plane normal| that still counts as crossing the
 * sketch plane.
 */
const POLYGON_SKETCH_RAY_GRAZE_LIMIT = 1e-4;

/** Working grid plane members a sketch frame is built from. */
export interface PolygonSketchGridPlane {
  /** World point the grid plane passes through. */
  origin: THREE.Vector3;
  /** Unit grid normal. */
  normal: THREE.Vector3;
  /** Unit grid U axis. */
  uAxis: THREE.Vector3;
  /** Unit grid V axis. */
  vAxis: THREE.Vector3;
}

/**
 * Builds Polygon sketch frames for views and maps between pointer rays, 2D
 * sketch coordinates and world points.
 */
export class PolygonSketchFrame {
  /**
   * Builds the frame of an orthographic view: the sketch plane faces the
   * camera, passes through the plane origin and extrudes toward the camera.
   *
   * @param viewForward Camera look direction in world space.
   * @param viewUp Camera up direction in world space.
   * @param planeOrigin World point the sketch plane passes through.
   * @param depth Extrusion depth along the frame normal.
   * @returns New sketch frame.
   */
  static fromView(
    viewForward: THREE.Vector3,
    viewUp: THREE.Vector3,
    planeOrigin: THREE.Vector3,
    depth: number,
  ): PolygonExtrusionFrame {
    const axisNormal = viewForward.clone().negate().normalize();
    const axisV = viewUp.clone().projectOnPlane(axisNormal).normalize();
    const axisU = new THREE.Vector3().crossVectors(axisV, axisNormal).normalize();
    return { origin: planeOrigin.clone(), axisU, axisV, axisNormal, extrusionMin: 0, extrusionMax: depth };
  }

  /**
   * Builds the frame of the working grid plane, extruding along the grid
   * normal.
   *
   * @param gridPlane Working grid plane.
   * @param depth Extrusion depth along the grid normal.
   * @returns New sketch frame.
   */
  static fromGridPlane(gridPlane: PolygonSketchGridPlane, depth: number): PolygonExtrusionFrame {
    return {
      origin: gridPlane.origin.clone(),
      axisU: gridPlane.uAxis.clone().normalize(),
      axisV: gridPlane.vAxis.clone().normalize(),
      axisNormal: gridPlane.normal.clone().normalize(),
      extrusionMin: 0,
      extrusionMax: depth,
    };
  }

  /**
   * Returns a deep copy of a sketch frame.
   *
   * @param frame Frame to copy.
   * @returns New frame with cloned vectors.
   */
  static copy(frame: PolygonExtrusionFrame): PolygonExtrusionFrame {
    return {
      origin: frame.origin.clone(),
      axisU: frame.axisU.clone(),
      axisV: frame.axisV.clone(),
      axisNormal: frame.axisNormal.clone(),
      extrusionMin: frame.extrusionMin,
      extrusionMax: frame.extrusionMax,
    };
  }

  /**
   * Intersects a pointer ray with the sketch plane and returns the 2D sketch
   * coordinate, rounded to the snap step when one is given.
   *
   * @param ray World pointer ray.
   * @param frame Sketch frame whose plane is hit.
   * @param snapStep Snap step in meters, or zero for no snapping.
   * @param allowBehindRayOrigin True for orthographic rays, whose origin may
   *   lie past the plane.
   * @returns 2D sketch coordinate, or null when the ray misses the plane.
   */
  static pointOnPlane(
    ray: THREE.Ray,
    frame: PolygonExtrusionFrame,
    snapStep: number,
    allowBehindRayOrigin: boolean,
  ): THREE.Vector2 | null {
    const distance = PolygonSketchFrame.rayDistanceToPlane(ray, frame);
    if (distance === null || (distance < 0 && !allowBehindRayOrigin)) {
      return null;
    }
    const relative = ray.at(distance, new THREE.Vector3()).sub(frame.origin);
    const u = PolygonSketchFrame.snap(relative.dot(frame.axisU), snapStep);
    const v = PolygonSketchFrame.snap(relative.dot(frame.axisV), snapStep);
    return new THREE.Vector2(u, v);
  }

  /**
   * Converts a 2D sketch coordinate into a world point lifted along the frame
   * normal.
   *
   * @param frame Sketch frame.
   * @param point 2D sketch coordinate.
   * @param normalOffset Offset along the frame normal.
   * @returns New world point.
   */
  static worldPointAt(frame: PolygonExtrusionFrame, point: THREE.Vector2, normalOffset: number): THREE.Vector3 {
    return frame.origin
      .clone()
      .addScaledVector(frame.axisU, point.x)
      .addScaledVector(frame.axisV, point.y)
      .addScaledVector(frame.axisNormal, normalOffset);
  }

  /**
   * Returns the signed ray distance to the sketch plane.
   *
   * @param ray World pointer ray.
   * @param frame Sketch frame.
   * @returns Signed distance along the ray, or null when the ray grazes the
   *   plane.
   */
  private static rayDistanceToPlane(ray: THREE.Ray, frame: PolygonExtrusionFrame): number | null {
    const denominator = ray.direction.dot(frame.axisNormal);
    if (Math.abs(denominator) < POLYGON_SKETCH_RAY_GRAZE_LIMIT) {
      return null;
    }
    return frame.origin.clone().sub(ray.origin).dot(frame.axisNormal) / denominator;
  }

  /**
   * Rounds a coordinate to the nearest multiple of a step.
   *
   * @param value Coordinate.
   * @param step Snap step, or zero or less for no snapping.
   * @returns Snapped coordinate.
   */
  private static snap(value: number, step: number): number {
    if (step <= 0) {
      return value;
    }
    return Math.round(value / step) * step;
  }
}
