import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  ClipPlanePreviewSheet,
  CLIP_PLANE_SHEET_OUTLINE_USERDATA_KEY,
  CLIP_PLANE_SHEET_USERDATA_KEY,
} from '@/tools/clip_plane/clip_plane_preview_sheet.js';

/**
 * Returns the eight corners of a box.
 *
 * @param bounds Box.
 * @returns Corner points.
 */
function boundsCorners(bounds: THREE.Box3): THREE.Vector3[] {
  const corners: THREE.Vector3[] = [];
  for (let cornerIndex = 0; cornerIndex < 8; cornerIndex++) {
    corners.push(
      new THREE.Vector3(
        cornerIndex & 1 ? bounds.max.x : bounds.min.x,
        cornerIndex & 2 ? bounds.max.y : bounds.min.y,
        cornerIndex & 4 ? bounds.max.z : bounds.min.z,
      ),
    );
  }
  return corners;
}

/** Proves the plane sheet: its size, its alignment and its parts. */
describe('ClipPlanePreviewSheet', () => {
  const bounds = new THREE.Box3(new THREE.Vector3(-1, 0, -2), new THREE.Vector3(3, 2, 2));
  const diagonalVerticalPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
    new THREE.Vector3(1, 0, 1).normalize(),
    new THREE.Vector3(1, 1, 0),
  );

  it('lies on the plane and covers every target corner projected onto it, with a margin', () => {
    const rectangle = ClipPlanePreviewSheet.rectangleCompute(diagonalVerticalPlane, bounds);
    expect(rectangle).not.toBeNull();
    const { center, halfAxisU, halfAxisV } = rectangle ?? {
      center: new THREE.Vector3(),
      halfAxisU: new THREE.Vector3(),
      halfAxisV: new THREE.Vector3(),
    };
    expect(diagonalVerticalPlane.distanceToPoint(center)).toBeCloseTo(0, 6);
    expect(halfAxisU.dot(diagonalVerticalPlane.normal)).toBeCloseTo(0, 6);
    expect(halfAxisV.dot(diagonalVerticalPlane.normal)).toBeCloseTo(0, 6);
    boundsCorners(bounds).forEach((corner) => {
      const offset = diagonalVerticalPlane.projectPoint(corner, new THREE.Vector3()).sub(center);
      expect(Math.abs(offset.dot(halfAxisU.clone().normalize()))).toBeLessThan(halfAxisU.length());
      expect(Math.abs(offset.dot(halfAxisV.clone().normalize()))).toBeLessThan(halfAxisV.length());
    });
  });

  it('runs one edge along the world axis lying in the plane, so 2D views see it edge-on', () => {
    const rectangle = ClipPlanePreviewSheet.rectangleCompute(diagonalVerticalPlane, bounds);
    const axisV = rectangle?.halfAxisV.clone().normalize() ?? new THREE.Vector3();
    expect(Math.abs(axisV.y)).toBeCloseTo(1, 6);
  });

  it('builds a translucent fill and an outline, and nothing for empty bounds', () => {
    const objects = ClipPlanePreviewSheet.sheetBuild(diagonalVerticalPlane, bounds);
    expect(objects.filter((object) => object.userData[CLIP_PLANE_SHEET_USERDATA_KEY])).toHaveLength(1);
    expect(objects.filter((object) => object.userData[CLIP_PLANE_SHEET_OUTLINE_USERDATA_KEY])).toHaveLength(1);
    const fill = objects.find((object) => object.userData[CLIP_PLANE_SHEET_USERDATA_KEY]) as THREE.Mesh;
    const material = fill.material as THREE.MeshBasicMaterial;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.side).toBe(THREE.DoubleSide);
    expect(ClipPlanePreviewSheet.sheetBuild(diagonalVerticalPlane, new THREE.Box3())).toEqual([]);
  });
});
