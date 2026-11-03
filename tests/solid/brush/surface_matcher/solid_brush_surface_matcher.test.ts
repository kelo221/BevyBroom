import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SolidBrushFactory } from '@/solid/brush/solid_brush_factory.js';
import type { SolidBrush } from '@/solid/brush/solid_brush.js';
import type { SolidPlane } from '@/solid/brush/solid_plane.js';
import { SolidBrushSurfaceMatcherPlane } from '@/solid/brush/surface_matcher/solid_brush_surface_matcher_plane.js';
import { SolidBrushSurfaceMatcherNormal } from '@/solid/brush/surface_matcher/solid_brush_surface_matcher_normal.js';
import { SolidBrushSurfaceMatcherFacing } from '@/solid/brush/surface_matcher/solid_brush_surface_matcher_facing.js';
import { SOLID_BRUSH_SURFACE_MATCH_NONE } from '@/solid/brush/surface_matcher/solid_brush_surface_matcher.js';

/**
 * Returns the index of the plane whose normal points most along a direction.
 *
 * @param planes Planes to search.
 * @param direction Direction the wanted normal points along.
 * @returns Index of the best aligned plane.
 */
function planeIndexAlong(planes: readonly SolidPlane[], direction: THREE.Vector3): number {
  let bestIndex = -1;
  let bestDot = Number.NEGATIVE_INFINITY;
  planes.forEach((plane, index) => {
    const dot = plane.normal.dot(direction);
    if (dot > bestDot) {
      bestDot = dot;
      bestIndex = index;
    }
  });
  return bestIndex;
}

/**
 * Returns a copy of a brush moved and rotated by a transform.
 *
 * @param brush Brush to copy.
 * @param matrix Transform applied to the copy.
 * @returns Transformed copy.
 */
function brushTransformed(brush: SolidBrush, matrix: THREE.Matrix4): SolidBrush {
  const copy = brush.clone();
  copy.transformVertices(matrix);
  return copy;
}

/** Proves each surface matcher picks the source face its rule describes. */
describe('SolidBrushSurfaceMatcher', () => {
  const up = new THREE.Vector3(0, 1, 0);

  it('plane matcher pairs every face of an identical brush with its coplanar twin', () => {
    const source = SolidBrushFactory.createCenteredBox(2, 3, 4);
    const destination = source.clone();
    const matcher = new SolidBrushSurfaceMatcherPlane();
    destination.planes.forEach((plane) => {
      const match = matcher.faceMatchFind(source.planes, plane);
      expect(source.planes[match]?.isAlignedWith(plane)).toBe(true);
    });
  });

  it('plane matcher rejects a face that moved off its plane', () => {
    const source = SolidBrushFactory.createCenteredBox(2, 2, 2);
    const raised = brushTransformed(source, new THREE.Matrix4().makeTranslation(0, 0.5, 0));
    const raisedTop = raised.planes[planeIndexAlong(raised.planes, up)];
    expect(raisedTop).toBeDefined();
    const match = new SolidBrushSurfaceMatcherPlane().faceMatchFind(source.planes, raisedTop as SolidPlane);
    expect(match).toBe(SOLID_BRUSH_SURFACE_MATCH_NONE);
  });

  it('normal matcher pairs a moved face with the parallel source face', () => {
    const source = SolidBrushFactory.createCenteredBox(2, 2, 2);
    const raised = brushTransformed(source, new THREE.Matrix4().makeTranslation(0, 0.5, 0));
    const raisedTop = raised.planes[planeIndexAlong(raised.planes, up)] as SolidPlane;
    const match = new SolidBrushSurfaceMatcherNormal().faceMatchFind(source.planes, raisedTop);
    expect(match).toBe(planeIndexAlong(source.planes, up));
  });

  it('normal matcher prefers the parallel face with the closest offset', () => {
    const lower = SolidBrushFactory.createCenteredBox(2, 2, 2);
    const upper = brushTransformed(lower, new THREE.Matrix4().makeTranslation(0, 4, 0));
    const combined = [...lower.planes, ...upper.planes];
    const nearUpper = brushTransformed(lower, new THREE.Matrix4().makeTranslation(0, 3.5, 0));
    const nearUpperTop = nearUpper.planes[planeIndexAlong(nearUpper.planes, up)] as SolidPlane;
    const match = new SolidBrushSurfaceMatcherNormal().faceMatchFind(combined, nearUpperTop);
    expect(match).toBe(lower.planes.length + planeIndexAlong(upper.planes, up));
  });

  it('normal matcher rejects faces that are not parallel', () => {
    const source = SolidBrushFactory.createCenteredBox(2, 2, 2);
    const turned = brushTransformed(source, new THREE.Matrix4().makeRotationY(Math.PI / 6));
    const sideDirection = new THREE.Vector3(1, 0, 0).applyAxisAngle(up, Math.PI / 6);
    const turnedSide = turned.planes[planeIndexAlong(turned.planes, sideDirection)] as SolidPlane;
    const match = new SolidBrushSurfaceMatcherNormal().faceMatchFind(source.planes, turnedSide);
    expect(match).toBe(SOLID_BRUSH_SURFACE_MATCH_NONE);
  });

  it('facing matcher pairs a turned face with the closest facing source face', () => {
    const source = SolidBrushFactory.createCenteredBox(2, 2, 2);
    const turned = brushTransformed(source, new THREE.Matrix4().makeRotationY(Math.PI / 6));
    const sideDirection = new THREE.Vector3(1, 0, 0).applyAxisAngle(up, Math.PI / 6);
    const turnedSide = turned.planes[planeIndexAlong(turned.planes, sideDirection)] as SolidPlane;
    const match = new SolidBrushSurfaceMatcherFacing().faceMatchFind(source.planes, turnedSide);
    expect(match).toBe(planeIndexAlong(source.planes, new THREE.Vector3(1, 0, 0)));
  });

  it('facing matcher rejects source faces that all face away', () => {
    const source = SolidBrushFactory.createCenteredBox(2, 2, 2);
    const bottomPlanes = [source.planes[planeIndexAlong(source.planes, up.clone().negate())] as SolidPlane];
    const top = source.planes[planeIndexAlong(source.planes, up)] as SolidPlane;
    expect(new SolidBrushSurfaceMatcherFacing().faceMatchFind(bottomPlanes, top)).toBe(SOLID_BRUSH_SURFACE_MATCH_NONE);
  });
});
