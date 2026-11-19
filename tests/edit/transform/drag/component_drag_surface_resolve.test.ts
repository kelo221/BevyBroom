import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  componentDragSurfaceResolve,
  type ComponentDragSurfaceRequest,
} from '@/edit/transform/drag/component_drag_surface_resolve.js';

/**
 * Builds a perspective camera at a position looking at the origin.
 *
 * @param position Camera position.
 * @returns Camera with updated matrices.
 */
function cameraLookingAtOrigin(position: THREE.Vector3): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.copy(position);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * Builds a request with no locks and no face normal.
 *
 * @param camera Viewport camera.
 * @returns Request with Y as grid up.
 */
function requestCreate(camera: THREE.Camera): ComponentDragSurfaceRequest {
  return {
    camera,
    pivot: new THREE.Vector3(),
    lockedLineDirection: null,
    lockedPlaneNormal: null,
    faceNormal: null,
    gridUp: new THREE.Vector3(0, 1, 0),
  };
}

/** Proves component drags pick a surface that follows the pointer predictably. */
describe('componentDragSurfaceResolve', () => {
  const obliqueCamera = cameraLookingAtOrigin(new THREE.Vector3(4, 6, 8));

  it('slides free vertex drags on the grid plane in a perspective view', () => {
    const surface = componentDragSurfaceResolve(requestCreate(obliqueCamera));
    expect(surface.kind).toBe('plane');
    if (surface.kind === 'plane') {
      expect(Math.abs(surface.plane.normal.y)).toBeCloseTo(1, 6);
    }
  });

  it('slides dragged faces along their normal', () => {
    const faceNormal = new THREE.Vector3(1, 0, 0);
    const surface = componentDragSurfaceResolve({ ...requestCreate(obliqueCamera), faceNormal });
    expect(surface.kind).toBe('line');
    if (surface.kind === 'line') {
      expect(Math.abs(surface.direction.dot(faceNormal))).toBeCloseTo(1, 6);
    }
  });

  it('follows an axis lock along its line, even over a face normal', () => {
    const lockedLineDirection = new THREE.Vector3(0, 0, 1);
    const request = { ...requestCreate(obliqueCamera), lockedLineDirection, faceNormal: new THREE.Vector3(1, 0, 0) };
    const surface = componentDragSurfaceResolve(request);
    expect(surface.kind === 'line' && Math.abs(surface.direction.z)).toBeCloseTo(1, 6);
  });

  it('falls back to the camera plane for an axis seen end-on', () => {
    const camera = cameraLookingAtOrigin(new THREE.Vector3(0, 0, 10));
    const surface = componentDragSurfaceResolve({
      ...requestCreate(camera),
      lockedLineDirection: new THREE.Vector3(0, 0, 1),
    });
    expect(surface.kind).toBe('plane');
  });

  it('falls back to the camera plane when the grid plane is seen edge-on', () => {
    const camera = cameraLookingAtOrigin(new THREE.Vector3(0, 0, 10));
    const surface = componentDragSurfaceResolve(requestCreate(camera));
    expect(surface.kind === 'plane' && Math.abs(surface.plane.normal.z)).toBeCloseTo(1, 6);
  });

  it('drags in the view plane of an orthographic 2D view', () => {
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    camera.position.set(0, 50, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const surface = componentDragSurfaceResolve({ ...requestCreate(camera), faceNormal: new THREE.Vector3(1, 0, 0) });
    expect(surface.kind === 'plane' && Math.abs(surface.plane.normal.y)).toBeCloseTo(1, 6);
  });
});
