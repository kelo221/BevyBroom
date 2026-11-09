import type * as THREE from 'three';
import type { PolygonExtrusionFrame } from '../polygon_convex_decomposer.js';
import { PolygonSketchFrame } from '../sketch/polygon_sketch_frame.js';

/** World-space vertex buffers of the Polygon outline preview. */
export interface PolygonOutlinePreviewBuffers {
  /** Segment endpoints of the placed outline edges, closing edge included. */
  outlineSegments: Float32Array;
  /** Segment endpoints from the last and first placed vertex to the cursor. */
  rubberBandSegments: Float32Array;
  /** Placed vertices followed by the cursor point when shown. */
  points: Float32Array;
}

/** Builds the world-space buffers the Polygon outline preview draws. */
export class PolygonOutlinePreviewGeometry {
  /**
   * Builds the preview buffers of an outline in progress.
   *
   * @param vertices Placed 2D outline vertices.
   * @param frame Sketch frame the vertices lie in.
   * @param cursor Pointer cursor on the sketch plane, or null when hidden.
   * @returns Segment and point buffers in world space.
   */
  static buffersBuild(
    vertices: readonly THREE.Vector2[],
    frame: PolygonExtrusionFrame,
    cursor: THREE.Vector2 | null,
  ): PolygonOutlinePreviewBuffers {
    const world = vertices.map((vertex) => PolygonSketchFrame.worldPointAt(frame, vertex, 0));
    const cursorWorld = cursor ? PolygonSketchFrame.worldPointAt(frame, cursor, 0) : null;
    return {
      outlineSegments: PolygonOutlinePreviewGeometry.outlineSegmentsBuild(world),
      rubberBandSegments: PolygonOutlinePreviewGeometry.rubberBandSegmentsBuild(world, cursorWorld),
      points: PolygonOutlinePreviewGeometry.pointsBuild(cursorWorld ? [...world, cursorWorld] : world),
    };
  }

  /**
   * Builds segments between consecutive placed vertices, closing the ring once
   * three vertices exist.
   *
   * @param world Placed vertices in world space.
   * @returns Flat segment endpoint coordinates.
   */
  private static outlineSegmentsBuild(world: readonly THREE.Vector3[]): Float32Array {
    const pairs: THREE.Vector3[] = [];
    for (let index = 1; index < world.length; index += 1) {
      PolygonOutlinePreviewGeometry.pairPush(pairs, world[index - 1], world[index]);
    }
    if (world.length >= 3) {
      PolygonOutlinePreviewGeometry.pairPush(pairs, world[world.length - 1], world[0]);
    }
    return PolygonOutlinePreviewGeometry.pointsBuild(pairs);
  }

  /**
   * Builds the rubber-band segments from the last placed vertex to the cursor
   * and from the cursor back to the first vertex.
   *
   * @param world Placed vertices in world space.
   * @param cursorWorld Cursor in world space, or null.
   * @returns Flat segment endpoint coordinates.
   */
  private static rubberBandSegmentsBuild(
    world: readonly THREE.Vector3[],
    cursorWorld: THREE.Vector3 | null,
  ): Float32Array {
    const pairs: THREE.Vector3[] = [];
    if (cursorWorld && world.length > 0) {
      PolygonOutlinePreviewGeometry.pairPush(pairs, world[world.length - 1], cursorWorld);
    }
    if (cursorWorld && world.length > 1) {
      PolygonOutlinePreviewGeometry.pairPush(pairs, cursorWorld, world[0]);
    }
    return PolygonOutlinePreviewGeometry.pointsBuild(pairs);
  }

  /**
   * Appends one segment when both endpoints exist.
   *
   * @param pairs Segment endpoint list to extend.
   * @param start Segment start, or undefined.
   * @param end Segment end, or undefined.
   */
  private static pairPush(
    pairs: THREE.Vector3[],
    start: THREE.Vector3 | undefined,
    end: THREE.Vector3 | undefined,
  ): void {
    if (start && end) {
      pairs.push(start, end);
    }
  }

  /**
   * Flattens world points into an xyz coordinate buffer.
   *
   * @param points World points.
   * @returns Flat coordinates.
   */
  private static pointsBuild(points: readonly THREE.Vector3[]): Float32Array {
    const buffer = new Float32Array(points.length * 3);
    points.forEach((point, index) => {
      point.toArray(buffer, index * 3);
    });
    return buffer;
  }
}
