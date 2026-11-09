import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { BoundsFace } from '@/types/bounds_face.js';
import { TransformMode } from '@/types/transform_mode.js';
import { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import { BOUNDS_SQUARE_FILL_KEY, BoundsHandleSquareStyler } from '@/transform/bounds/handle/bounds_handle_square.js';
import { boundsHandleFacesIsCorner, boundsHandleFacesRead } from '@/transform/bounds/handle/bounds_handle_faces.js';
import {
  boundsHandleSquareLayoutForCamera,
  type BoundsHandleSquareLayout,
} from '@/transform/bounds/handle/bounds_handle_square_layout.js';
import { getBoundsFaceLocalNormal } from '@/transform/bounds/builder_oriented_bounds.js';
import { BOUNDS_CUBE_PICK_KEY } from '@/transform/bounds/gizmo_bounds_keys.js';
import { GizmoRaycaster } from '@/transform/gizmo/gizmo_raycaster.js';
import { pointerClientPointOfWorld } from '@/utils/pointer_client_project.js';

/** Drawable height of the fake 2D pane in CSS pixels. */
const PANE_HEIGHT_PX = 512;

/** A selected box shown in a top (xz) pane. */
interface TopViewRig {
  gizmo: GizmoTransform;
  box: THREE.Mesh;
  clone: THREE.Group;
  camera: THREE.OrthographicCamera;
}

/**
 * Builds a selected box and a top pane camera framing it.
 *
 * @param size Box size.
 * @param position Box position.
 * @param frustumHalfHeight Half height of the top camera frustum (zoom).
 * @param mode Bounds widget mode.
 * @returns Rig with a styled top-view gizmo clone.
 */
function topViewRigCreate(
  size: THREE.Vector3,
  position: THREE.Vector3,
  frustumHalfHeight: number,
  mode: TransformMode = TransformMode.BOUNDS,
): TopViewRig {
  const box = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial());
  box.position.copy(position);
  box.updateMatrixWorld(true);
  const gizmo = new GizmoTransform(Theme);
  gizmo.setMode(mode);
  gizmo.setVisible(true);
  gizmo.updateBoundsFromMeshes([box]);
  const clone = gizmo.getHandleGroupClone('xz');
  const camera = topCameraCreate(position, frustumHalfHeight);
  gizmo.prepareBoundsCloneForCamera(clone, camera, 'xz', PANE_HEIGHT_PX);
  clone.updateMatrixWorld(true);
  return { gizmo, box, clone, camera };
}

/**
 * Creates a top orthographic camera centered over a point.
 *
 * @param target Point to look at.
 * @param frustumHalfHeight Half height of the frustum.
 * @returns Camera looking down −Y.
 */
function topCameraCreate(target: THREE.Vector3, frustumHalfHeight: number): THREE.OrthographicCamera {
  const halfHeight = frustumHalfHeight;
  const camera = new THREE.OrthographicCamera(-halfHeight, halfHeight, halfHeight, -halfHeight, 0.1, 1000);
  camera.position.copy(target).add(new THREE.Vector3(0, 50, 0));
  camera.up.set(0, 0, -1);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * Lists visible resize squares under a clone.
 *
 * @param root Gizmo clone.
 * @returns Visible square roots.
 */
function visibleSquares(root: THREE.Object3D): THREE.Object3D[] {
  const squares: THREE.Object3D[] = [];
  root.traverse((child) => {
    if (BoundsHandleSquareStyler.isSquare(child) && child.visible) {
      squares.push(child);
    }
  });
  return squares;
}

/**
 * Counts visible 3D arrow pick roots under a clone.
 *
 * @param root Gizmo clone.
 * @returns Number of visible arrows.
 */
function visibleArrowCount(root: THREE.Object3D): number {
  let count = 0;
  root.traverse((child) => {
    if (child.visible && child.userData[BOUNDS_CUBE_PICK_KEY] === true) {
      count += 1;
    }
  });
  return count;
}

/**
 * Returns the world edge length of the first visible square's white fill.
 *
 * @param rig Top view rig.
 * @returns Fill world size, or 0 without a visible square.
 */
function squareWorldSize(rig: TopViewRig): number {
  const square = visibleSquares(rig.clone)[0];
  const fill = square?.children.find((child) => child.userData[BOUNDS_SQUARE_FILL_KEY] === true);
  return fill ? fill.getWorldScale(new THREE.Vector3()).x : 0;
}

/**
 * Lists every corner square under a clone, shown or hidden.
 *
 * @param root Gizmo clone.
 * @returns Corner square roots.
 */
function cornerSquaresAll(root: THREE.Object3D): THREE.Object3D[] {
  const corners: THREE.Object3D[] = [];
  root.traverse((child) => {
    if (BoundsHandleSquareStyler.isSquare(child) && boundsHandleFacesIsCorner(boundsHandleFacesRead(child))) {
      corners.push(child);
    }
  });
  return corners;
}

/**
 * Picks the gizmo handle under a world point in the rig's top pane.
 *
 * @param rig Top view rig.
 * @param worldPoint Point under the pointer.
 * @returns Faces of the picked handle, or null when nothing is picked.
 */
function pickedFacesAt(rig: TopViewRig, worldPoint: THREE.Vector3): readonly BoundsFace[] | null {
  const pickElement = document.createElement('div');
  pickElement.getBoundingClientRect = () => new DOMRect(0, 0, PANE_HEIGHT_PX, PANE_HEIGHT_PX);
  const point = pointerClientPointOfWorld(worldPoint, rig.camera, pickElement);
  const event = new MouseEvent('pointerdown', { clientX: point.clientX, clientY: point.clientY, button: 0 });
  rig.clone.visible = true;
  const picked = new GizmoRaycaster().pickHandle(rig.gizmo.getHandles(), rig.camera, pickElement, event, rig.clone);
  return picked ? boundsHandleFacesRead(picked.getVisualMesh()) : null;
}

/**
 * Computes where a square for some faces must sit around a world box.
 *
 * @param box World box of the selection.
 * @param faces Faces of the square.
 * @param layout Square layout for the pane zoom.
 * @returns Expected world position.
 */
function expectedSquareWorldPosition(
  box: THREE.Box3,
  faces: readonly BoundsFace[],
  layout: BoundsHandleSquareLayout,
): THREE.Vector3 {
  const center = box.getCenter(new THREE.Vector3());
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  faces.forEach((face) => {
    const normal = getBoundsFaceLocalNormal(face);
    const reach = Math.abs(normal.dot(half)) + layout.outwardGap;
    center.addScaledVector(normal, reach);
  });
  return center;
}

/**
 * 2D panes draw the bounds gizmo the Hammer way: eight small white squares at
 * the corners and edge midpoints of the selection rectangle, constant on
 * screen.
 */
describe('GizmoBoundsScreenStyle 2D squares', () => {
  it('shows four edge squares and four corner squares and no arrows in a top pane', () => {
    const rig = topViewRigCreate(new THREE.Vector3(3, 1, 2), new THREE.Vector3(1, 0.5, -2), 6);
    const squares = visibleSquares(rig.clone);
    const corners = squares.filter((square) => boundsHandleFacesIsCorner(boundsHandleFacesRead(square)));
    expect(squares).toHaveLength(8);
    expect(corners).toHaveLength(4);
    expect(visibleArrowCount(rig.clone)).toBe(0);
    rig.gizmo.dispose();
  });

  it('places squares at the rectangle corners and edge midpoints just outside the box', () => {
    const rig = topViewRigCreate(new THREE.Vector3(4, 2, 1.5), new THREE.Vector3(-3, 1, 5), 8);
    const box = new THREE.Box3().setFromObject(rig.box);
    const layout = boundsHandleSquareLayoutForCamera(rig.camera, PANE_HEIGHT_PX);
    visibleSquares(rig.clone).forEach((square) => {
      const faces = boundsHandleFacesRead(square);
      const actual = square.getWorldPosition(new THREE.Vector3());
      const expected = expectedSquareWorldPosition(box, faces, layout);
      expect(actual.x).toBeCloseTo(expected.x, 6);
      expect(actual.z).toBeCloseTo(expected.z, 6);
    });
    rig.gizmo.dispose();
  });

  it('keeps the visible square the same pixel size at every zoom', () => {
    const size = new THREE.Vector3(2, 2, 2);
    const near = topViewRigCreate(size, new THREE.Vector3(), 3);
    const far = topViewRigCreate(size, new THREE.Vector3(), 30);
    const nearLayout = boundsHandleSquareLayoutForCamera(near.camera, PANE_HEIGHT_PX);
    const farLayout = boundsHandleSquareLayoutForCamera(far.camera, PANE_HEIGHT_PX);
    expect(squareWorldSize(near)).toBeCloseTo(nearLayout.visualSize, 8);
    expect(squareWorldSize(far)).toBeCloseTo(farLayout.visualSize, 8);
    near.gizmo.dispose();
    far.gizmo.dispose();
  });

  it('hides corner squares that would overlap edge squares on a box tiny on screen', () => {
    const rig = topViewRigCreate(new THREE.Vector3(0.5, 1, 0.5), new THREE.Vector3(), 200);
    const squares = visibleSquares(rig.clone);
    expect(squares.filter((square) => boundsHandleFacesIsCorner(boundsHandleFacesRead(square)))).toHaveLength(0);
    expect(squares).toHaveLength(4);
    rig.gizmo.dispose();
  });

  it('picks a shown corner square as its two faces', () => {
    const rig = topViewRigCreate(new THREE.Vector3(3, 1, 2), new THREE.Vector3(1, 0.5, -2), 6);
    const corner = cornerSquaresAll(rig.clone).find((square) => square.visible);
    expect(corner).toBeDefined();
    const cornerFaces = boundsHandleFacesRead(corner ?? new THREE.Object3D());
    const picked = pickedFacesAt(rig, (corner ?? new THREE.Object3D()).getWorldPosition(new THREE.Vector3()));
    expect([...(picked ?? [])].sort()).toEqual([...cornerFaces].sort());
    rig.gizmo.dispose();
  });

  it('never picks a corner square hidden on a box tiny on screen', () => {
    const rig = topViewRigCreate(new THREE.Vector3(0.5, 1, 0.5), new THREE.Vector3(), 200);
    const hiddenCorners = cornerSquaresAll(rig.clone).filter((square) => !square.visible);
    expect(hiddenCorners.length).toBeGreaterThan(0);
    hiddenCorners.forEach((corner) => {
      const picked = pickedFacesAt(rig, corner.getWorldPosition(new THREE.Vector3()));
      expect(picked === null || !boundsHandleFacesIsCorner(picked)).toBe(true);
    });
    rig.gizmo.dispose();
  });

  it('keeps six 3D arrows and no squares in the perspective pane', () => {
    const rig = topViewRigCreate(new THREE.Vector3(2, 2, 2), new THREE.Vector3(), 5);
    const perspective = rig.gizmo.getHandleGroupClone('xyz');
    expect(visibleSquares(perspective)).toHaveLength(0);
    expect(visibleArrowCount(perspective)).toBe(6);
    rig.gizmo.dispose();
  });

  it('offers only edge squares in shear mode', () => {
    const rig = topViewRigCreate(new THREE.Vector3(2, 2, 2), new THREE.Vector3(), 5, TransformMode.SHEAR);
    const squares = visibleSquares(rig.clone);
    expect(squares).toHaveLength(4);
    expect(squares.every((square) => !boundsHandleFacesIsCorner(boundsHandleFacesRead(square)))).toBe(true);
    rig.gizmo.dispose();
  });

  it('hides every square while resizing is forbidden', () => {
    const rig = topViewRigCreate(new THREE.Vector3(2, 2, 2), new THREE.Vector3(), 5);
    rig.gizmo.setBoundsResizeAllowed(false);
    rig.gizmo.prepareBoundsCloneForCamera(rig.clone, rig.camera, 'xz', PANE_HEIGHT_PX);
    expect(visibleSquares(rig.clone)).toHaveLength(0);
    rig.gizmo.dispose();
  });

  it('tints only the hovered corner square', () => {
    const rig = topViewRigCreate(new THREE.Vector3(2, 2, 2), new THREE.Vector3(), 5);
    const hoveredFaces = [BoundsFace.POS_X, BoundsFace.NEG_Z];
    rig.gizmo.setHighlightedBoundsFaces(hoveredFaces);
    const tinted = visibleSquares(rig.clone).filter((square) => {
      const fill = square.children.find((child) => child.userData[BOUNDS_SQUARE_FILL_KEY] === true);
      const material = fill instanceof THREE.Mesh ? (fill.material as THREE.MeshBasicMaterial) : null;
      return material?.color.getHex() === Theme.boundsHandleHoverColor;
    });
    expect(tinted).toHaveLength(1);
    expect([...boundsHandleFacesRead(tinted[0] ?? new THREE.Object3D())].sort()).toEqual([...hoveredFaces].sort());
    rig.gizmo.dispose();
  });
});
