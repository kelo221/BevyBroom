import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createBoundsHandlePickVolumeGeometry,
  getViewPlaneDepthDirection,
} from '@/transform/bounds/bounds_handle_geometry.js';
import { getCadViewPlaneAxes, type CadViewPlane } from '@/rulers/view/cad_view_plane.js';

describe('bounds handle shared geometry helpers', () => {
  it('builds a unit cube for perspective arrow pick volumes', () => {
    const geometry = createBoundsHandlePickVolumeGeometry();
    geometry.computeBoundingBox();
    const size = geometry.boundingBox?.getSize(new THREE.Vector3());
    expect(geometry).toBeInstanceOf(THREE.BoxGeometry);
    expect(size?.toArray()).toEqual([1, 1, 1]);
    geometry.dispose();
  });

  it('returns the unit depth axis of every orthographic view plane', () => {
    const planes: CadViewPlane[] = ['xz', 'xy', 'yz'];
    planes.forEach((plane) => {
      const depth = getViewPlaneDepthDirection(plane);
      const depthAxis = getCadViewPlaneAxes(plane).depthAxis;
      expect(depth).not.toBeNull();
      expect(depthAxis).not.toBeNull();
      expect(depth?.length()).toBeCloseTo(1, 10);
      expect(depth?.getComponent(depthAxis ?? 0)).toBeCloseTo(1, 10);
    });
  });

  it('has no depth axis in the perspective pane', () => {
    expect(getViewPlaneDepthDirection('xyz')).toBeNull();
  });
});
