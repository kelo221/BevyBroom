import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MeshDocument } from '@/mesh/document/mesh_document.js';
import { MeshTopologyBuilder } from '@/mesh/topology/mesh_topology_builder.js';
import { MESH_EDIT_DOCUMENT_USERDATA_KEY } from '@/edit/mesh/mesh_edit_binding.js';
import type { ComponentSelectionEntry } from '@/edit/component/component_selection_entry.js';
import type { EditDomainTarget } from '@/edit/session/edit_session_domain.js';
import { HandlerComponentTransform } from '@/edit/transform/handler_component_transform.js';
import {
  computeComponentTransformPivot,
  expandComponentSelectionToTransformVertices,
} from '@/edit/transform/component_transform_selection.js';
import { readComponentTransformVertexLocal } from '@/edit/transform/component_transform_vertex.js';
import { componentDragFaceNormalWorld } from '@/edit/transform/drag/component_drag_face_normal.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { GizmoAxis, TransformMode } from '@/types/transform_mode.js';

/** Grid step used by every case. */
const GRID_STEP = 0.25;

/** Side of the square pick element in client pixels. */
const VIEW_SIZE = 400;

/**
 * Builds a flat quad mesh on the ground plane, offset off the grid.
 *
 * @param offGridOffset Offset added to every corner along X and Z.
 * @returns Mesh and its domain.
 */
function groundQuadCreate(offGridOffset: number): { mesh: THREE.Mesh; domain: EditDomainTarget[] } {
  const builder = new MeshTopologyBuilder();
  const corners = [
    [0, 0, 0],
    [0, 0, 1],
    [1, 0, 1],
    [1, 0, 0],
  ].map(([x, y, z]) => builder.appendVertex((x ?? 0) + offGridOffset, y ?? 0, (z ?? 0) + offGridOffset));
  builder.appendFace(corners);
  const mesh = new THREE.Mesh(new THREE.BufferGeometry());
  mesh.userData[MESH_EDIT_DOCUMENT_USERDATA_KEY] = new MeshDocument(builder.build());
  mesh.updateMatrixWorld(true);
  return { mesh, domain: [{ kind: 'content_mesh', mesh, targetId: mesh.uuid }] };
}

/**
 * Builds a perspective camera looking down at the origin at an angle.
 *
 * @returns Camera with updated matrices.
 */
function obliqueCameraCreate(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  camera.position.set(3, 6, 8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * Builds a pick element with a fixed square client rectangle.
 *
 * @returns Element.
 */
function pickElementCreate(): HTMLElement {
  const element = document.createElement('div');
  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: VIEW_SIZE, height: VIEW_SIZE, right: VIEW_SIZE, bottom: VIEW_SIZE }),
  });
  return element;
}

/**
 * Projects a world point to client pixels of the pick element.
 *
 * @param camera Camera.
 * @param point World point.
 * @returns Client position.
 */
function clientOf(camera: THREE.Camera, point: THREE.Vector3): { x: number; y: number } {
  const ndc = point.clone().project(camera);
  return { x: ((ndc.x + 1) / 2) * VIEW_SIZE, y: ((1 - ndc.y) / 2) * VIEW_SIZE };
}

/**
 * Drags the selected components from one world point to another on screen.
 *
 * @param selected Selection to drag.
 * @param domain Edit domain.
 * @param from World point under the press.
 * @param to World point under the release.
 * @returns The dragged vertices after the drag.
 */
function dragOnScreen(
  selected: ComponentSelectionEntry[],
  domain: EditDomainTarget[],
  from: THREE.Vector3,
  to: THREE.Vector3,
): ReturnType<typeof expandComponentSelectionToTransformVertices> {
  const camera = obliqueCameraCreate();
  const handler = new HandlerComponentTransform(new GridSnap(true, GRID_STEP), null);
  const vertices = expandComponentSelectionToTransformVertices(selected, domain);
  const pivot = computeComponentTransformPivot(vertices) ?? new THREE.Vector3();
  handler.setFaceNormalHint(componentDragFaceNormalWorld(selected, domain));
  const start = clientOf(camera, from);
  const end = clientOf(camera, to);
  handler.beginSingleUseDrag(TransformMode.TRANSLATE, vertices, pivot, camera, pickElementCreate(), start.x, start.y);
  handler.applyPointerMove(end.x, end.y);
  handler.commitIfNeeded();
  return vertices;
}

/**
 * Returns whether a value lies on the test grid.
 *
 * @param value Coordinate.
 * @returns True on a grid line.
 */
function onTestGrid(value: number): boolean {
  return Math.abs(value / GRID_STEP - Math.round(value / GRID_STEP)) < 1e-6;
}

/**
 * Proves free component drags in the 3D view follow the pointer on the grid
 * plane and land on the grid.
 */
describe('component drag translation in a perspective view', () => {
  it('moves a dragged vertex across the ground without lifting it and lands it on the grid', () => {
    const offset = GRID_STEP * 0.4;
    const { mesh, domain } = groundQuadCreate(offset);
    const start = new THREE.Vector3(offset, 0, offset);
    const target = new THREE.Vector3(-1.37, 0, -0.62);
    const vertices = dragOnScreen([{ targetId: mesh.uuid, kind: 'vertex', componentKey: '0' }], domain, start, target);
    const moved = readComponentTransformVertexLocal(vertices[0] as (typeof vertices)[number]);
    expect(moved.y).toBeCloseTo(0, 6);
    expect(onTestGrid(moved.x)).toBe(true);
    expect(onTestGrid(moved.z)).toBe(true);
    expect(moved.distanceTo(target)).toBeLessThanOrEqual(GRID_STEP);
  });

  it('slides a dragged face along its normal only', () => {
    const { mesh, domain } = groundQuadCreate(0);
    const faceCenter = new THREE.Vector3(0.5, 0, 0.5);
    const raised = new THREE.Vector3(0.5, 1.1, 0.5);
    const vertices = dragOnScreen(
      [{ targetId: mesh.uuid, kind: 'face', componentKey: '0' }],
      domain,
      faceCenter,
      raised,
    );
    for (const vertex of vertices) {
      const moved = readComponentTransformVertexLocal(vertex);
      expect(moved.x).toBeCloseTo(vertex.initialLocal.x, 6);
      expect(moved.z).toBeCloseTo(vertex.initialLocal.z, 6);
      expect(moved.y).toBeCloseTo(1, 6);
    }
  });

  it('reports the shared normal of face-only selections and none for mixed ones', () => {
    const { mesh, domain } = groundQuadCreate(0);
    const face: ComponentSelectionEntry = { targetId: mesh.uuid, kind: 'face', componentKey: '0' };
    expect(Math.abs(componentDragFaceNormalWorld([face], domain)?.y ?? 0)).toBeCloseTo(1, 6);
    const vertex: ComponentSelectionEntry = { targetId: mesh.uuid, kind: 'vertex', componentKey: '0' };
    expect(componentDragFaceNormalWorld([face, vertex], domain)).toBeNull();
  });

  it('follows the pointer along a gizmo arrow and lands the vertex on the grid', () => {
    const offset = GRID_STEP * 0.4;
    const { mesh, domain } = groundQuadCreate(offset);
    const camera = obliqueCameraCreate();
    const handler = new HandlerComponentTransform(new GridSnap(true, GRID_STEP), null);
    const vertices = expandComponentSelectionToTransformVertices(
      [{ targetId: mesh.uuid, kind: 'vertex', componentKey: '0' }],
      domain,
    );
    const pivot = computeComponentTransformPivot(vertices) ?? new THREE.Vector3();
    const start = clientOf(camera, pivot);
    const end = clientOf(camera, pivot.clone().add(new THREE.Vector3(1.6, 0, 0)));
    const element = pickElementCreate();
    handler.beginGizmoHandleDrag(
      TransformMode.TRANSLATE,
      GizmoAxis.X,
      new THREE.Quaternion(),
      vertices,
      pivot,
      camera,
      element,
      start.x,
      start.y,
    );
    handler.applyPointerMove(end.x, end.y);
    const moved = readComponentTransformVertexLocal(vertices[0] as (typeof vertices)[number]);
    expect(onTestGrid(moved.x)).toBe(true);
    expect(moved.x).toBeCloseTo(pivot.x + 1.6, 0);
    expect(moved.y).toBeCloseTo(pivot.y, 6);
    expect(moved.z).toBeCloseTo(pivot.z, 6);
  });
});
