import * as THREE from 'three';
import { PolygonSketchFrame } from './sketch/polygon_sketch_frame.js';

/** Extrusion frame mapping 2D polygon coordinates into 3D world space. */
export interface PolygonExtrusionFrame {
  /** World-space origin of the 2D sketching plane. */
  origin: THREE.Vector3;
  /** Unit vector along the 2D X axis. */
  axisU: THREE.Vector3;
  /** Unit vector along the 2D Y axis. */
  axisV: THREE.Vector3;
  /** Unit normal along which the polygon is extruded. */
  axisNormal: THREE.Vector3;
  /** Minimum offset along `axisNormal`. */
  extrusionMin: number;
  /** Maximum offset along `axisNormal`. */
  extrusionMax: number;
}

/**
 * Decomposes a 2D simple polygon (convex or concave) into convex 2D pieces via
 * ear clipping + Hertel-Mehlhorn convex merging, and extrudes them into 3D
 * convex point sets.
 */
export class PolygonConvexDecomposer {
  /**
   * Decomposes a 2D polygon into convex 2D sub-polygons (CCW winding).
   *
   * @param outline Input 2D polygon vertices (at least 3).
   * @returns Array of convex 2D polygons.
   */
  static decompose2d(outline: readonly THREE.Vector2[]): THREE.Vector2[][] {
    const cleaned = PolygonConvexDecomposer.cleanOutline(outline);
    if (cleaned.length < 3) {
      return [];
    }
    const ccw = PolygonConvexDecomposer.ensureCounterClockwise(cleaned);
    if (PolygonConvexDecomposer.isConvexPolygon(ccw)) {
      return [ccw];
    }
    const triangles = PolygonConvexDecomposer.earClipTriangulate(ccw);
    return PolygonConvexDecomposer.mergeConvexPieces(triangles);
  }

  /**
   * Extrudes a 2D polygon (convex or concave) into 3D convex prism point sets.
   *
   * @param outline 2D polygon vertices.
   * @param frame Extrusion plane and depth range.
   * @returns One 3D vertex array per convex brush piece.
   */
  static extrudeToWorldPieces(outline: readonly THREE.Vector2[], frame: PolygonExtrusionFrame): THREE.Vector3[][] {
    const span = Math.abs(frame.extrusionMax - frame.extrusionMin);
    if (span < 1e-4) {
      return [];
    }
    const convexPolygons = PolygonConvexDecomposer.decompose2d(outline);
    return convexPolygons.map((poly) => PolygonConvexDecomposer.extrudeSingleConvex(poly, frame));
  }

  /**
   * Removes consecutive duplicate vertices from a 2D polygon outline.
   *
   * @param outline Raw 2D vertices.
   * @returns Deduplicated vertex list.
   */
  private static cleanOutline(outline: readonly THREE.Vector2[]): THREE.Vector2[] {
    const result: THREE.Vector2[] = [];
    for (const pt of outline) {
      const prev = result[result.length - 1];
      if (!prev || prev.distanceToSquared(pt) > 1e-8) {
        result.push(pt.clone());
      }
    }
    const first = result[0];
    const last = result[result.length - 1];
    if (result.length > 2 && first && last && last.distanceToSquared(first) <= 1e-8) {
      result.pop();
    }
    return result;
  }

  /**
   * Ensures a 2D polygon is wound counter-clockwise.
   *
   * @param poly Cleaned 2D polygon.
   * @returns Counter-clockwise vertex array.
   */
  private static ensureCounterClockwise(poly: THREE.Vector2[]): THREE.Vector2[] {
    return PolygonConvexDecomposer.signedArea(poly) < 0 ? [...poly].reverse() : poly;
  }

  /**
   * Computes twice the signed area of a 2D polygon.
   *
   * @param poly 2D polygon vertices.
   * @returns Signed area value (positive for CCW).
   */
  private static signedArea(poly: readonly THREE.Vector2[]): number {
    let sum = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (a && b) {
        sum += a.x * b.y - b.x * a.y;
      }
    }
    return sum * 0.5;
  }

  /**
   * Tests whether a CCW 2D polygon is strictly convex.
   *
   * @param poly CCW 2D polygon vertices.
   * @returns True when every interior turn is left-handed.
   */
  static isConvexPolygon(poly: readonly THREE.Vector2[]): boolean {
    if (poly.length < 3) {
      return false;
    }
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const c = poly[(i + 2) % poly.length];
      if (!a || !b || !c || PolygonConvexDecomposer.cross2d(a, b, c) < -1e-6) {
        return false;
      }
    }
    return true;
  }

  /**
   * Computes the 2D cross product `(b - a) x (c - a)`.
   *
   * @param a First point.
   * @param b Second point.
   * @param c Third point.
   * @returns Scalar Z component of cross product.
   */
  private static cross2d(a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2): number {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  }

  /**
   * Triangulates a CCW simple polygon using ear clipping.
   *
   * @param ccw Counter-clockwise polygon vertices.
   * @returns List of CCW triangles.
   */
  private static earClipTriangulate(ccw: readonly THREE.Vector2[]): THREE.Vector2[][] {
    const remaining = ccw.map((p) => p.clone());
    const triangles: THREE.Vector2[][] = [];
    let guard = remaining.length * 3;
    while (remaining.length > 3 && guard > 0) {
      guard -= 1;
      const earIndex = PolygonConvexDecomposer.findEarIndex(remaining);
      const n = remaining.length;
      const prev = remaining[(earIndex + n - 1) % n];
      const curr = remaining[earIndex];
      const next = remaining[(earIndex + 1) % n];
      if (prev && curr && next) {
        triangles.push([prev.clone(), curr.clone(), next.clone()]);
      }
      remaining.splice(earIndex, 1);
    }
    if (remaining.length === 3) {
      triangles.push(remaining);
    }
    return triangles;
  }

  /**
   * Finds the index of a valid convex ear in the remaining polygon.
   *
   * @param poly Remaining CCW polygon vertices.
   * @returns Ear vertex index.
   */
  private static findEarIndex(poly: readonly THREE.Vector2[]): number {
    for (let i = 0; i < poly.length; i++) {
      if (PolygonConvexDecomposer.isEarAt(poly, i)) {
        return i;
      }
    }
    return 0;
  }

  /**
   * Tests whether vertex `index` forms an ear in `poly`.
   *
   * @param poly Remaining CCW polygon.
   * @param index Candidate vertex index.
   * @returns True when convex and containing no other polygon vertex.
   */
  private static isEarAt(poly: readonly THREE.Vector2[], index: number): boolean {
    const n = poly.length;
    const a = poly[(index + n - 1) % n];
    const b = poly[index];
    const c = poly[(index + 1) % n];
    if (!a || !b || !c || PolygonConvexDecomposer.cross2d(a, b, c) <= 1e-6) {
      return false;
    }
    for (let j = 0; j < n; j++) {
      const p = poly[j];
      if (p && j !== (index + n - 1) % n && j !== index && j !== (index + 1) % n) {
        if (PolygonConvexDecomposer.pointInTriangle(p, a, b, c)) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Tests whether point `p` lies inside or on CCW triangle `(a, b, c)`.
   *
   * @param p Test point.
   * @param a Triangle vertex A.
   * @param b Triangle vertex B.
   * @param c Triangle vertex C.
   * @returns True when inside or on boundary.
   */
  private static pointInTriangle(p: THREE.Vector2, a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2): boolean {
    const c1 = PolygonConvexDecomposer.cross2d(a, b, p);
    const c2 = PolygonConvexDecomposer.cross2d(b, c, p);
    const c3 = PolygonConvexDecomposer.cross2d(c, a, p);
    return c1 >= -1e-6 && c2 >= -1e-6 && c3 >= -1e-6;
  }

  /**
   * Greedily merges adjacent convex pieces when their union remains convex.
   *
   * @param pieces Initial triangle list.
   * @returns Reduced list of convex polygons.
   */
  private static mergeConvexPieces(pieces: THREE.Vector2[][]): THREE.Vector2[][] {
    const list = pieces.map((p) => [...p]);
    let mergedAny = true;
    while (mergedAny) {
      mergedAny = PolygonConvexDecomposer.tryMergeOnePair(list);
    }
    return list;
  }

  /**
   * Searches for one pair of polygons sharing an edge whose union is convex.
   *
   * @param list Mutable list of convex polygons.
   * @returns True when a merge occurred.
   */
  private static tryMergeOnePair(list: THREE.Vector2[][]): boolean {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const polyA = list[i];
        const polyB = list[j];
        const merged = polyA && polyB ? PolygonConvexDecomposer.tryMergeSharedEdge(polyA, polyB) : null;
        if (merged) {
          list[i] = merged;
          list.splice(j, 1);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Attempts to merge two CCW polygons along a shared reversed edge.
   *
   * @param polyA First CCW polygon.
   * @param polyB Second CCW polygon.
   * @returns Combined CCW convex polygon, or null if not mergeable.
   */
  private static tryMergeSharedEdge(
    polyA: readonly THREE.Vector2[],
    polyB: readonly THREE.Vector2[],
  ): THREE.Vector2[] | null {
    for (let i = 0; i < polyA.length; i++) {
      const a0 = polyA[i];
      const a1 = polyA[(i + 1) % polyA.length];
      const edgeB = a0 && a1 ? PolygonConvexDecomposer.findReversedEdge(polyB, a0, a1) : -1;
      if (edgeB >= 0) {
        const combined = PolygonConvexDecomposer.splicePolygonsAtEdge(polyA, i, polyB, edgeB);
        if (PolygonConvexDecomposer.isConvexPolygon(combined)) {
          return combined;
        }
      }
    }
    return null;
  }

  /**
   * Finds edge index `j` in `polyB` where `polyB[j] == a1` and `polyB[j+1] ==
   * a0`.
   *
   * @param polyB Candidate polygon.
   * @param a0 Start of edge in polyA.
   * @param a1 End of edge in polyA.
   * @returns Edge index in polyB, or -1.
   */
  private static findReversedEdge(polyB: readonly THREE.Vector2[], a0: THREE.Vector2, a1: THREE.Vector2): number {
    for (let j = 0; j < polyB.length; j++) {
      const b0 = polyB[j];
      const b1 = polyB[(j + 1) % polyB.length];
      if (b0 && b1 && b0.distanceToSquared(a1) <= 1e-8 && b1.distanceToSquared(a0) <= 1e-8) {
        return j;
      }
    }
    return -1;
  }

  /**
   * Splices two CCW polygons along shared edge `edgeA` / `edgeB`.
   *
   * @param polyA First polygon.
   * @param edgeA Shared edge index in polyA.
   * @param polyB Second polygon.
   * @param edgeB Shared edge index in polyB.
   * @returns Combined polygon vertex ring.
   */
  private static splicePolygonsAtEdge(
    polyA: readonly THREE.Vector2[],
    edgeA: number,
    polyB: readonly THREE.Vector2[],
    edgeB: number,
  ): THREE.Vector2[] {
    const out: THREE.Vector2[] = [];
    for (let k = 1; k < polyA.length; k++) {
      const pt = polyA[(edgeA + k) % polyA.length];
      if (pt) out.push(pt.clone());
    }
    for (let k = 1; k < polyB.length; k++) {
      const pt = polyB[(edgeB + k) % polyB.length];
      if (pt) out.push(pt.clone());
    }
    return out;
  }

  /**
   * Extrudes one convex 2D polygon into a 3D prism point cloud.
   *
   * @param poly2d Convex 2D polygon.
   * @param frame Extrusion plane and depth range.
   * @returns 3D world vertices of the prism.
   */
  private static extrudeSingleConvex(poly2d: readonly THREE.Vector2[], frame: PolygonExtrusionFrame): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    for (const pt of poly2d) {
      points.push(PolygonSketchFrame.worldPointAt(frame, pt, frame.extrusionMin));
      points.push(PolygonSketchFrame.worldPointAt(frame, pt, frame.extrusionMax));
    }
    return points;
  }
}
