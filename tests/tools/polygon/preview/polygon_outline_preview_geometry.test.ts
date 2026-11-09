import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PolygonOutlinePreviewGeometry } from '@/tools/polygon/preview/polygon_outline_preview_geometry.js';
import { PolygonSketchFrame } from '@/tools/polygon/sketch/polygon_sketch_frame.js';

/**
 * Splits a flat xyz buffer into world points.
 *
 * @param buffer Flat coordinates.
 * @returns Points.
 */
function pointsFromBuffer(buffer: Float32Array): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index < buffer.length; index += 3) {
    points.push(new THREE.Vector3().fromArray(buffer, index));
  }
  return points;
}

/**
 * Builds an arbitrary tilted sketch frame away from the origin.
 *
 * @returns Frame.
 */
function tiltedFrameCreate() {
  return PolygonSketchFrame.fromView(
    new THREE.Vector3(1, -2, -3).normalize(),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(4, 1, -6),
    2,
  );
}

describe('PolygonOutlinePreviewGeometry', () => {
  it('draws placed points in world space plus the cursor point', () => {
    const frame = tiltedFrameCreate();
    const vertices = [new THREE.Vector2(0, 0), new THREE.Vector2(2, 0)];
    const cursor = new THREE.Vector2(1, 3);
    const buffers = PolygonOutlinePreviewGeometry.buffersBuild(vertices, frame, cursor);
    const points = pointsFromBuffer(buffers.points);
    expect(points).toHaveLength(3);
    [...vertices, cursor].forEach((vertex, index) => {
      const expected = PolygonSketchFrame.worldPointAt(frame, vertex, 0);
      expect(points[index]?.distanceTo(expected)).toBeLessThan(1e-5);
    });
  });

  it('closes the outline once three points exist and rubber-bands from both ends to the cursor', () => {
    const frame = tiltedFrameCreate();
    const vertices = [new THREE.Vector2(0, 0), new THREE.Vector2(2, 0), new THREE.Vector2(2, 2)];
    const cursor = new THREE.Vector2(0, 2);
    const buffers = PolygonOutlinePreviewGeometry.buffersBuild(vertices, frame, cursor);
    expect(pointsFromBuffer(buffers.outlineSegments)).toHaveLength(vertices.length * 2);
    const rubberBand = pointsFromBuffer(buffers.rubberBandSegments);
    expect(rubberBand).toHaveLength(4);
    const last = PolygonSketchFrame.worldPointAt(frame, vertices[2] ?? new THREE.Vector2(), 0);
    const first = PolygonSketchFrame.worldPointAt(frame, vertices[0] ?? new THREE.Vector2(), 0);
    const cursorWorld = PolygonSketchFrame.worldPointAt(frame, cursor, 0);
    expect(rubberBand[0]?.distanceTo(last)).toBeLessThan(1e-5);
    expect(rubberBand[1]?.distanceTo(cursorWorld)).toBeLessThan(1e-5);
    expect(rubberBand[3]?.distanceTo(first)).toBeLessThan(1e-5);
  });

  it('draws an open edge for two points and nothing but the cursor without points', () => {
    const frame = tiltedFrameCreate();
    const twoPoints = PolygonOutlinePreviewGeometry.buffersBuild(
      [new THREE.Vector2(0, 0), new THREE.Vector2(1, 1)],
      frame,
      null,
    );
    expect(pointsFromBuffer(twoPoints.outlineSegments)).toHaveLength(2);
    expect(twoPoints.rubberBandSegments).toHaveLength(0);
    const cursorOnly = PolygonOutlinePreviewGeometry.buffersBuild([], frame, new THREE.Vector2(1, 1));
    expect(cursorOnly.outlineSegments).toHaveLength(0);
    expect(cursorOnly.rubberBandSegments).toHaveLength(0);
    expect(pointsFromBuffer(cursorOnly.points)).toHaveLength(1);
  });
});
