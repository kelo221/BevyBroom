import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { BoundsFace } from '@/types/bounds_face.js';
import { TransformMode } from '@/types/transform_mode.js';
import { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import { GizmoRaycaster } from '@/transform/gizmo/gizmo_raycaster.js';
import { TransformExecutor } from '@/transform/core/transform_executor.js';
import { TransformConstraint } from '@/transform/core/transform_constraint.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { HandlerTransform } from '@/transform/core/handler_transform.js';
import { managerMouseCursor } from '@/input/manager_mouse_cursor.js';
import { pointerClientPointOfWorld } from '@/utils/pointer_client_project.js';

describe('TransformHandler', () => {
  let handler: HandlerTransform;
  let gizmo: GizmoTransform;
  let raycaster: GizmoRaycaster;
  let executor: TransformExecutor;
  let constraint: TransformConstraint;

  beforeEach(() => {
    managerMouseCursor.reset();
    constraint = new TransformConstraint();
    executor = new TransformExecutor(new GridSnap(false, 1.0));
    raycaster = new GizmoRaycaster();
    gizmo = new GizmoTransform(Theme);
    handler = new HandlerTransform(gizmo, raycaster, executor, constraint);
  });

  afterEach(() => {
    managerMouseCursor.reset();
  });

  it('should start with no drag active', () => {
    expect(handler.isDragging()).toBe(false);
    expect(handler.isBusy()).toBe(false);
  });

  it('beginSingleUseDrag hides the gizmo (Shape Editor / Blender single-use)', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.position.set(10, 20, 30);
    mesh.updateMatrixWorld(true);
    gizmo.setMode(TransformMode.BOUNDS);
    gizmo.setVisible(true);
    const pickElement = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    } as unknown as HTMLElement;
    const camera = new THREE.PerspectiveCamera();
    const pivot = new THREE.Vector3(10, 20, 30);
    expect(handler.beginSingleUseDrag(TransformMode.TRANSLATE, [mesh], pivot, camera, pickElement, 100, 100)).toBe(
      true,
    );
    expect(handler.isSingleUseDrag()).toBe(true);
    expect(gizmo.getMode()).toBe(TransformMode.TRANSLATE);
    expect(gizmo.isVisible()).toBe(false);
  });

  it('beginSingleUseDrag hides gizmo for rotate and scale modes', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    mesh.updateMatrixWorld(true);
    gizmo.setVisible(true);
    const pickElement = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    } as unknown as HTMLElement;
    const camera = new THREE.PerspectiveCamera();
    const pivot = new THREE.Vector3(0, 0, 0);
    expect(handler.beginSingleUseDrag(TransformMode.ROTATE, [mesh], pivot, camera, pickElement, 0, 0)).toBe(true);
    expect(gizmo.isVisible()).toBe(false);
    handler.cancelActiveDragIfNeeded();
    gizmo.setVisible(true);
    expect(handler.beginSingleUseDrag(TransformMode.SCALE, [mesh], pivot, camera, pickElement, 0, 0)).toBe(true);
    expect(gizmo.isVisible()).toBe(false);
  });

  it('should start with no active axis', () => {
    expect(handler.getActiveAxis()).toBeNull();
  });

  it('should onPointerUp clear drag state', () => {
    handler.onPointerUp();
    expect(handler.isDragging()).toBe(false);
    expect(handler.isBusy()).toBe(false);
    expect(handler.getActiveAxis()).toBeNull();
  });

  it('should onPointerUp clear active handle on gizmo', () => {
    const handles = gizmo.getHandles();
    if (handles.length > 0) {
      gizmo.setActiveHandle(handles[0] ?? null);
    }
    handler.onPointerUp();
    expect(gizmo.getActiveHandle()).toBeNull();
  });

  it('should not start a drag when Ctrl is held for multi-select', () => {
    const setup = createBoundsPickSetup(gizmo);
    handler.onPointerDown(
      setup.camera,
      setup.pickElement,
      new MouseEvent('pointerdown', { clientX: 400, clientY: 300, ctrlKey: true }),
      setup.handles,
      setup.meshes,
      setup.pivot,
      setup.gizmoGroup,
    );
    expect(handler.isDragging()).toBe(false);
  });

  it('should not start a bounds drag when Shift is held for multi-select', () => {
    const setup = createBoundsPickSetup(gizmo);
    handler.onPointerDown(
      setup.camera,
      setup.pickElement,
      new MouseEvent('pointerdown', { clientX: 400, clientY: 300, shiftKey: true }),
      setup.handles,
      setup.meshes,
      setup.pivot,
      setup.gizmoGroup,
    );
    expect(handler.isDragging()).toBe(false);
  });

  it('leaves a press on the bounds face interior to the active tool', () => {
    const setup = createBoundsPickSetup(gizmo);
    const interior = pointerClientPointOfWorld(boundsFaceInteriorPoint(setup.meshes), setup.camera, setup.pickElement);
    handler.onPointerDown(
      setup.camera,
      setup.pickElement,
      new MouseEvent('pointerdown', { clientX: interior.clientX, clientY: interior.clientY }),
      setup.handles,
      setup.meshes,
      setup.pivot,
      setup.gizmoGroup,
    );
    expect(handler.isDragging()).toBe(false);
  });

  it('does not highlight the face interior while hovering away from handles', () => {
    const setup = createBoundsPickSetup(gizmo);
    const interior = pointerClientPointOfWorld(boundsFaceInteriorPoint(setup.meshes), setup.camera, setup.pickElement);
    handler.updateBoundsHover(
      setup.camera,
      setup.pickElement,
      new MouseEvent('pointermove', { clientX: interior.clientX, clientY: interior.clientY }),
      setup.gizmoGroup,
    );
    expect(gizmo.getHighlightedBoundsFace()).toBeNull();
  });

  it('clears bounds hover highlight and stops re-issuing the hover cursor', () => {
    const setup = createBoundsPickSetup(gizmo);
    const handlePoint = pointerClientPointOfWorld(boundsCenter(setup.meshes), setup.camera, setup.pickElement);
    handler.updateBoundsHover(
      setup.camera,
      setup.pickElement,
      new MouseEvent('pointermove', { clientX: handlePoint.clientX, clientY: handlePoint.clientY }),
      setup.gizmoGroup,
    );
    expect(gizmo.getHighlightedBoundsFace()).toBe(BoundsFace.POS_Z);
    expect(managerMouseCursor.getAppliedTargetElement()).toBe(setup.pickElement);
    handler.clearBoundsHover(setup.pickElement);
    expect(gizmo.getHighlightedBoundsFace()).toBeNull();
    managerMouseCursor.update();
    managerMouseCursor.update();
    expect(managerMouseCursor.getAppliedCursorCss()).toBe('');
    handler.refreshBoundsHoverCursor();
    expect(managerMouseCursor.getAppliedCursorCss()).toBe('');
  });

  it('starts a bounds resize from the handle facing the camera and ends it on pointer up', () => {
    const setup = createBoundsPickSetup(gizmo);
    const handlePoint = pointerClientPointOfWorld(boundsCenter(setup.meshes), setup.camera, setup.pickElement);
    handler.onPointerDown(
      setup.camera,
      setup.pickElement,
      new MouseEvent('pointerdown', { clientX: handlePoint.clientX, clientY: handlePoint.clientY }),
      setup.handles,
      setup.meshes,
      setup.pivot,
      setup.gizmoGroup,
    );
    expect(handler.isDragging()).toBe(true);
    expect(handler.isBoundsResizeDrag()).toBe(true);
    handler.onPointerUp(setup.pivot, setup.meshes);
    expect(handler.isDragging()).toBe(false);
  });
});

/**
 * Builds a bounds-mode pick environment with a centered mesh and viewport gizmo
 * clone.
 *
 * @param gizmo The transform gizmo under test.
 * @returns Camera, renderer.domElement, handles, and group for pointer-down
 *   tests.
 */
function createBoundsPickSetup(gizmo: GizmoTransform): {
  camera: THREE.PerspectiveCamera;
  pickElement: HTMLElement;
  handles: ReturnType<GizmoTransform['getHandles']>;
  meshes: THREE.Mesh[];
  pivot: THREE.Vector3;
  gizmoGroup: THREE.Group;
} {
  gizmo.setMode(TransformMode.BOUNDS);
  gizmo.setVisible(true);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
  mesh.updateMatrixWorld(true);
  gizmo.updateBoundsFromMeshes([mesh]);
  const gizmoGroup = gizmo.getHandleGroupClone();
  gizmoGroup.visible = true;
  gizmoGroup.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(60, 800 / 600, 0.1, 1000);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  };
  return {
    camera,
    pickElement: canvas as unknown as HTMLElement,
    handles: gizmo.getHandles(),
    meshes: [mesh],
    pivot: new THREE.Vector3(0, 0, 0),
    gizmoGroup,
  };
}

/**
 * Returns the world center of the test meshes' bounds.
 *
 * @param meshes Test meshes.
 * @returns World center.
 */
function boundsCenter(meshes: readonly THREE.Mesh[]): THREE.Vector3 {
  const bounds = new THREE.Box3();
  meshes.forEach((mesh) => bounds.expandByObject(mesh));
  return bounds.getCenter(new THREE.Vector3());
}

/**
 * Returns a point on the camera-facing +Z bounds face halfway between its
 * center and its corner, away from the resize handle in the face center.
 *
 * @param meshes Test meshes.
 * @returns World point inside the +Z face.
 */
function boundsFaceInteriorPoint(meshes: readonly THREE.Mesh[]): THREE.Vector3 {
  const bounds = new THREE.Box3();
  meshes.forEach((mesh) => bounds.expandByObject(mesh));
  const center = bounds.getCenter(new THREE.Vector3());
  return new THREE.Vector3((center.x + bounds.max.x) / 2, (center.y + bounds.max.y) / 2, bounds.max.z);
}
