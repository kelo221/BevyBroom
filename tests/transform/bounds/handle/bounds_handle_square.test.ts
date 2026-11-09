import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { BoundsFace } from '@/types/bounds_face.js';
import { BOUNDS_SQUARE_FILL_KEY, BoundsHandleSquareStyler } from '@/transform/bounds/handle/bounds_handle_square.js';
import { boundsHandleSquareLayoutFromFallback } from '@/transform/bounds/handle/bounds_handle_square_layout.js';
import { BOUNDS_CUBE_PICK_KEY } from '@/transform/bounds/gizmo_bounds_keys.js';

/**
 * Builds a handle mesh with a stand-in 3D arrow child, the way a cloned edge
 * handle arrives at the styler.
 *
 * @param handleId Handle id stored on the mesh.
 * @returns Handle mesh.
 */
function arrowHandleCreate(handleId: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mesh.userData['handleId'] = handleId;
  mesh.userData[BOUNDS_CUBE_PICK_KEY] = true;
  mesh.add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4), new THREE.MeshBasicMaterial()));
  return mesh;
}

/**
 * Returns the fill child of a square.
 *
 * @param square Square root.
 * @returns Fill mesh.
 */
function squareFillOf(square: THREE.Object3D): THREE.Mesh {
  const fill = square.children.find((child) => child.userData[BOUNDS_SQUARE_FILL_KEY] === true);
  if (!(fill instanceof THREE.Mesh)) {
    throw new Error('Square has no fill mesh');
  }
  return fill;
}

/**
 * Hammer-style 2D resize squares: white filled square with a thin outline over
 * an invisible larger pick square.
 */
describe('BoundsHandleSquareStyler', () => {
  it('replaces arrow visuals with a hidden pick square, a white fill and an outline', () => {
    const styler = new BoundsHandleSquareStyler(Theme);
    const handleId = 41;
    const mesh = arrowHandleCreate(handleId);
    styler.squareEnsure(mesh);
    expect(BoundsHandleSquareStyler.isSquare(mesh)).toBe(true);
    expect(mesh.userData[BOUNDS_CUBE_PICK_KEY]).toBe(false);
    expect((mesh.material as THREE.Material).visible).toBe(false);
    const fill = squareFillOf(mesh);
    const outline = mesh.children.find((child) => child instanceof THREE.LineSegments) as THREE.LineSegments;
    expect(mesh.children).toHaveLength(2);
    expect((fill.material as THREE.MeshBasicMaterial).color.getHex()).toBe(Theme.boundsHandleColor);
    expect((outline.material as THREE.LineBasicMaterial).color.getHex()).toBe(Theme.boundsHandleOutlineColor);
    expect(fill.userData['handleId']).toBeUndefined();
  });

  it('builds square geometry: equal width and height', () => {
    const styler = new BoundsHandleSquareStyler(Theme);
    const mesh = arrowHandleCreate(1);
    styler.squareEnsure(mesh);
    const fill = squareFillOf(mesh);
    fill.geometry.computeBoundingBox();
    const size = fill.geometry.boundingBox?.getSize(new THREE.Vector3()) ?? new THREE.Vector3();
    expect(size.x).toBeGreaterThan(0);
    expect(size.x).toBeCloseTo(size.y, 10);
    expect(size.z).toBeCloseTo(0, 10);
  });

  it('converts a handle only once', () => {
    const styler = new BoundsHandleSquareStyler(Theme);
    const mesh = arrowHandleCreate(2);
    styler.squareEnsure(mesh);
    const fill = squareFillOf(mesh);
    styler.squareEnsure(mesh);
    expect(squareFillOf(mesh)).toBe(fill);
  });

  it('places a corner square at both faces plus the gap and sizes pick and visual squares', () => {
    const styler = new BoundsHandleSquareStyler(Theme);
    const mesh = arrowHandleCreate(3);
    styler.squareEnsure(mesh);
    const halfExtents = new THREE.Vector3(2, 1, 0.5);
    const layout = boundsHandleSquareLayoutFromFallback(0.26);
    styler.squarePlace(mesh, [BoundsFace.NEG_X, BoundsFace.POS_Y], halfExtents, layout);
    expect(mesh.position.x).toBeCloseTo(-(halfExtents.x + layout.outwardGap), 10);
    expect(mesh.position.y).toBeCloseTo(halfExtents.y + layout.outwardGap, 10);
    expect(mesh.position.z).toBeCloseTo(0, 10);
    expect(mesh.scale.x).toBeCloseTo(layout.pickSize, 10);
    expect(mesh.scale.x * squareFillOf(mesh).scale.x).toBeCloseTo(layout.visualSize, 10);
  });

  it('lays the square flat in the view plane', () => {
    const styler = new BoundsHandleSquareStyler(Theme);
    const mesh = arrowHandleCreate(4);
    const depth = new THREE.Vector3(0, 1, 0);
    styler.squareOrient(mesh, depth);
    const squareNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
    expect(squareNormal.distanceTo(depth)).toBeLessThan(1e-9);
  });

  it('tints the fill with the hover colour and back', () => {
    const styler = new BoundsHandleSquareStyler(Theme);
    const mesh = arrowHandleCreate(5);
    styler.squareEnsure(mesh);
    const fillMaterial = squareFillOf(mesh).material as THREE.MeshBasicMaterial;
    styler.squareHighlightApply(mesh, true);
    expect(fillMaterial.color.getHex()).toBe(Theme.boundsHandleHoverColor);
    styler.squareHighlightApply(mesh, false);
    expect(fillMaterial.color.getHex()).toBe(Theme.boundsHandleColor);
  });
});
