import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { GizmoBounds } from '@/transform/bounds/gizmo_bounds.js';
import { Theme } from '@/theme.js';
import { DataOrientedBounds } from '@/transform/bounds/builder_oriented_bounds.js';
import { BoundsFace } from '@/types/bounds_face.js';
import { BOUNDS_FACE_EDGE_HIGHLIGHT_KEY } from '@/transform/bounds/bounds_face_highlight.js';

describe('GizmoBounds', () => {
  let gizmo: GizmoBounds;

  beforeEach(() => {
    gizmo = new GizmoBounds(Theme);
  });

  it('should create six mid-face resize handles', () => {
    const handles = gizmo.createHandles();
    expect(handles).toHaveLength(6);
  });

  it('should expose a root scene object', () => {
    gizmo.createHandles();
    const objects = gizmo.getAllSceneObjects();
    expect(objects).toHaveLength(1);
    expect(objects[0]).toBeInstanceOf(THREE.Group);
  });

  it('should update pose from oriented bounds', () => {
    gizmo.createHandles();
    const bounds = createBounds(new THREE.Vector3(1, 2, 3), new THREE.Vector3(2, 1, 0.5));
    gizmo.updateFromBounds(bounds, 0.3);
    const current = gizmo.getCurrentBounds();
    expect(current).not.toBeNull();
    expect(current!.center.x).toBeCloseTo(1, 5);
    expect(current!.halfExtents.x).toBeCloseTo(2, 5);
  });

  it('should hide root when bounds are cleared', () => {
    gizmo.createHandles();
    gizmo.updateFromBounds(createBounds(new THREE.Vector3(), new THREE.Vector3(1, 1, 1)));
    gizmo.updateFromBounds(null);
    expect(gizmo.getAllSceneObjects()[0]!.visible).toBe(false);
  });

  it('should build six resize handles and no meshes that are not resize handles', () => {
    gizmo.createHandles();
    gizmo.updateFromBounds(createBounds(new THREE.Vector3(), new THREE.Vector3(1, 1, 1)), 0.3);
    const root = gizmo.getAllSceneObjects()[0]!;
    let handleCount = 0;
    let meshesWithoutHandleId = 0;
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (typeof child.userData['handleId'] !== 'number') meshesWithoutHandleId += 1;
      if (child.visible && child.userData['boundsCubePick'] === true) handleCount += 1;
    });
    expect(handleCount).toBe(6);
    expect(meshesWithoutHandleId).toBe(0);
  });

  it('keeps cube pick volumes out of the transparent draw list', () => {
    gizmo.createHandles();
    gizmo.updateFromBounds(createBounds(new THREE.Vector3(), new THREE.Vector3(1, 1, 1)), 0.3);
    const root = gizmo.getAllSceneObjects()[0]!;
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (child.userData['boundsCubePick'] !== true) return;
      const material = child.material as THREE.MeshBasicMaterial;
      expect(material.visible).toBe(false);
      expect(material.transparent).toBe(false);
      expect(material.colorWrite).toBe(false);
    });
  });

  it('should outline only the highlighted face with selection orange edges', () => {
    gizmo.createHandles();
    gizmo.updateFromBounds(createBounds(new THREE.Vector3(), new THREE.Vector3(1, 1, 1)), 0.3);
    gizmo.setHighlightedFace(BoundsFace.POS_X);
    expect(gizmo.getHighlightedFace()).toBe(BoundsFace.POS_X);
    const root = gizmo.getAllSceneObjects()[0]!;
    let visibleEdges = 0;
    root.traverse((child) => {
      if (child.userData[BOUNDS_FACE_EDGE_HIGHLIGHT_KEY] !== true) return;
      if (child.visible) visibleEdges += 1;
    });
    expect(visibleEdges).toBe(1);
    gizmo.setHighlightedFace(null);
    expect(gizmo.getHighlightedFace()).toBeNull();
  });

  it('should keep guide lines hidden until explicitly shown', () => {
    gizmo.createHandles();
    gizmo.updateFromBounds(createBounds(new THREE.Vector3(), new THREE.Vector3(1, 1, 1)));
    expect(gizmo.areGuideLinesVisible()).toBe(false);
    gizmo.setGuideLinesVisible(true);
    expect(gizmo.areGuideLinesVisible()).toBe(true);
  });

  it('shows resize grips by default and across bounds updates', () => {
    gizmo.createHandles();
    gizmo.updateFromBounds(createBounds(new THREE.Vector3(), new THREE.Vector3(1, 1, 1)));
    expect(gizmo.isResizeAllowed()).toBe(true);
    expect(countVisibleResizeHandles(gizmo)).toBe(6);
    gizmo.updateFromBounds(createBounds(new THREE.Vector3(1, 0, 0), new THREE.Vector3(1.5, 1, 1)));
    expect(countVisibleResizeHandles(gizmo)).toBe(6);
  });

  it('keeps resize grips hidden across bounds updates while resizing is forbidden', () => {
    gizmo.createHandles();
    gizmo.updateFromBounds(createBounds(new THREE.Vector3(), new THREE.Vector3(1, 1, 1)));
    gizmo.setResizeAllowed(false);
    expect(gizmo.isResizeAllowed()).toBe(false);
    expect(countVisibleResizeHandles(gizmo)).toBe(0);
    gizmo.updateFromBounds(createBounds(new THREE.Vector3(2, 0, 0), new THREE.Vector3(1, 2, 1)));
    expect(countVisibleResizeHandles(gizmo)).toBe(0);
    gizmo.setResizeAllowed(true);
    expect(gizmo.isResizeAllowed()).toBe(true);
    expect(countVisibleResizeHandles(gizmo)).toBe(6);
  });

  it('should include guide line object under the root group', () => {
    gizmo.createHandles();
    const root = gizmo.getAllSceneObjects()[0]!;
    let found = false;
    root.traverse((child) => {
      if (child.userData['isBoundsGuideLines'] === true) found = true;
    });
    expect(found).toBe(true);
  });
});

/**
 * Builds simple axis-aligned bounds for gizmo tests.
 *
 * @param center World center.
 * @param halfExtents Local half extents.
 * @returns Oriented bounds data.
 */
function createBounds(center: THREE.Vector3, halfExtents: THREE.Vector3): DataOrientedBounds {
  return {
    center,
    quaternion: new THREE.Quaternion(),
    halfExtents,
  };
}

/**
 * Counts visible mid-face resize grip roots under the bounds gizmo.
 *
 * @param gizmo Bounds gizmo under test.
 * @returns Number of visible pick-root handle meshes.
 */
function countVisibleResizeHandles(gizmo: GizmoBounds): number {
  let count = 0;
  const root = gizmo.getAllSceneObjects()[0]!;
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (child.userData['boundsCubePick'] !== true) return;
    if (child.visible) count += 1;
  });
  return count;
}
