import * as THREE from 'three';
import { SolidDualHull } from '@/solid/algorithm/surface/solid_dual_hull.js';
import { solidHullLoops } from '@/solid/algorithm/surface/solid_hull_loops.js';

/** Distance below which two points count as the same hull vertex. */
const SHA_DRAW_PREVIEW_WELD_EPSILON_SQUARED = 1e-8;

/**
 * Builds the wireframe segments of convex point sets from their hull face
 * loops.
 *
 * @param pieces Convex point sets.
 * @returns Flat segment endpoint coordinates (two points per edge).
 */
export function shapeDrawPreviewSegmentsCreate(pieces: readonly THREE.Vector3[][]): Float32Array {
  const segments: number[] = [];
  for (const piece of pieces) {
    shapeDrawPreviewPieceSegmentsAppend(segments, piece);
  }
  return new Float32Array(segments);
}

/**
 * Formats one segment endpoint coordinate for dedupe keys.
 *
 * @param value Coordinate value.
 * @returns Quantized text key.
 */
function shapeDrawPreviewCoordinateKey(value: number): string {
  return value.toFixed(5);
}

/**
 * Appends the outline segments of one convex point set.
 *
 * @param segments Accumulated endpoint coordinates.
 * @param piece Convex point set.
 */
function shapeDrawPreviewPieceSegmentsAppend(segments: number[], piece: readonly THREE.Vector3[]): void {
  const points = shapeDrawPreviewWeldedPointsCreate(piece);
  const triangles = SolidDualHull.triangles(points);
  if (!triangles) {
    return;
  }
  const seenEdges = new Set<string>();
  for (const loop of solidHullLoops(points, triangles) ?? []) {
    shapeDrawPreviewLoopSegmentsAppend(segments, loop, seenEdges);
  }
}

/**
 * Appends the outline segments of one hull face loop.
 *
 * @param segments Accumulated endpoint coordinates.
 * @param loop Face loop points in order.
 */
function shapeDrawPreviewLoopSegmentsAppend(segments: number[], loop: THREE.Vector3[], seenEdges: Set<string>): void {
  for (let index = 0; index < loop.length; index += 1) {
    const from = loop[index];
    const to = loop[(index + 1) % loop.length];
    if (from && to && shapeDrawPreviewEdgeIsNew(seenEdges, from, to)) {
      segments.push(from.x, from.y, from.z, to.x, to.y, to.z);
    }
  }
}

/**
 * Records one hull edge the first time it is seen.
 *
 * @param seenEdges Edge keys already drawn.
 * @param from Segment start.
 * @param to Segment end.
 * @returns True when the edge had not been drawn before.
 */
function shapeDrawPreviewEdgeIsNew(seenEdges: Set<string>, from: THREE.Vector3, to: THREE.Vector3): boolean {
  const first = `${shapeDrawPreviewCoordinateKey(from.x)}_${shapeDrawPreviewCoordinateKey(from.y)}_${shapeDrawPreviewCoordinateKey(from.z)}`;
  const second = `${shapeDrawPreviewCoordinateKey(to.x)}_${shapeDrawPreviewCoordinateKey(to.y)}_${shapeDrawPreviewCoordinateKey(to.z)}`;
  const key = first < second ? `${first}|${second}` : `${second}|${first}`;
  if (seenEdges.has(key)) {
    return false;
  }
  seenEdges.add(key);
  return true;
}

/**
 * Drops points that sit on an earlier point.
 *
 * @param piece Convex point set.
 * @returns Unique points.
 */
function shapeDrawPreviewWeldedPointsCreate(piece: readonly THREE.Vector3[]): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (const point of piece) {
    const duplicate = points.some(
      (existing) => existing.distanceToSquared(point) <= SHA_DRAW_PREVIEW_WELD_EPSILON_SQUARED,
    );
    if (!duplicate) {
      points.push(point);
    }
  }
  return points;
}
