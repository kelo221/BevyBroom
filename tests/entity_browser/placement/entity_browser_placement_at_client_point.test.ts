import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EntityBrowserCatalogBuilder } from '@/entity_browser/catalog/entity_browser_catalog_builder.js';
import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';
import {
  EntityBrowserPlacementAtClientPoint,
  type EntityBrowserPlacementViewport,
} from '@/entity_browser/placement/entity_browser_placement_at_client_point.js';
import {
  computeCameraForwardSpawnPosition,
  DEFAULT_SPAWN_DISTANCE,
} from '@/navigation/placement/object_spawn_placement.js';
import {
  entityBrowserTestEditorCreate,
  entityBrowserTestNewChildren,
  type EntityBrowserTestEditor,
} from '../entity_browser_test_support.js';

/** Client rectangle of the fake viewport element. */
const VIEWPORT_RECT = { left: 120, top: 60, width: 400, height: 300 };

/**
 * Creates a viewport element whose client rectangle is {@link VIEWPORT_RECT}.
 *
 * @returns Viewport element.
 */
function viewportElementCreate(): HTMLElement {
  const element = document.createElement('div');
  const { left, top, width, height } = VIEWPORT_RECT;
  element.getBoundingClientRect = () => new DOMRect(left, top, width, height);
  return element;
}

/**
 * Returns whether a client point lies inside {@link VIEWPORT_RECT}.
 *
 * @param clientX Client X.
 * @param clientY Client Y.
 * @returns True inside the viewport.
 */
function viewportContains(clientX: number, clientY: number): boolean {
  const { left, top, width, height } = VIEWPORT_RECT;
  return clientX >= left && clientX <= left + width && clientY >= top && clientY <= top + height;
}

/**
 * Builds a placement helper over one viewport of a test editor.
 *
 * @param editor Test editor.
 * @param camera Camera of the viewport.
 * @returns Placement helper.
 */
function placementCreate(editor: EntityBrowserTestEditor, camera: THREE.Camera): EntityBrowserPlacementAtClientPoint {
  const viewport: EntityBrowserPlacementViewport = { camera, pickElement: viewportElementCreate() };
  return new EntityBrowserPlacementAtClientPoint({
    viewportAtClientPointResolve: (clientX, clientY) => (viewportContains(clientX, clientY) ? viewport : null),
    spawnCameraOverrideRun: (spawnCamera, action) => editor.handler.spawnCameraOverrideRun(spawnCamera, action),
  });
}

/**
 * Returns the view ray through a client point of the viewport.
 *
 * @param camera Viewport camera.
 * @param clientX Client X.
 * @param clientY Client Y.
 * @returns World ray.
 */
function viewRayThrough(camera: THREE.Camera, clientX: number, clientY: number): THREE.Ray {
  const { left, top, width, height } = VIEWPORT_RECT;
  const ndc = new THREE.Vector2(((clientX - left) / width) * 2 - 1, -((clientY - top) / height) * 2 + 1);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  return raycaster.ray.clone();
}

/**
 * Returns the point light entry of a test editor's catalog.
 *
 * @param editor Test editor.
 * @returns Point light catalog entry.
 */
function pointLightEntry(editor: EntityBrowserTestEditor): EntityBrowserCatalogEntry {
  const entry = EntityBrowserCatalogBuilder.catalogBuild(editor.actions).find((item) => item.id === 'lights.point');
  if (!entry) throw new Error('missing point light entry');
  return entry;
}

/**
 * Places a catalog entry and returns the one object it added.
 *
 * @param editor Test editor.
 * @param placement Placement helper.
 * @param entry Catalog entry.
 * @param clientPoint Drop point.
 * @returns Added object.
 */
function placeAndFind(
  editor: EntityBrowserTestEditor,
  placement: EntityBrowserPlacementAtClientPoint,
  entry: EntityBrowserCatalogEntry,
  clientPoint: { x: number; y: number },
): THREE.Object3D {
  const before = [...editor.world.children];
  expect(placement.place(entry, clientPoint.x, clientPoint.y)).toBe(true);
  const added = entityBrowserTestNewChildren(editor.world, before);
  expect(added).toHaveLength(1);
  const [object] = added;
  if (!object) throw new Error('nothing was placed');
  return object;
}

/**
 * Dropping a tile places the entry on the view ray through the drop point using
 * the editor's own spawn placement.
 */
describe('EntityBrowserPlacementAtClientPoint', () => {
  it('places at the view center the same way the Add menu does', () => {
    const editor = entityBrowserTestEditorCreate();
    const placement = placementCreate(editor, editor.camera);
    const center = { x: VIEWPORT_RECT.left + VIEWPORT_RECT.width / 2, y: VIEWPORT_RECT.top + VIEWPORT_RECT.height / 2 };
    const placed = placeAndFind(editor, placement, pointLightEntry(editor), center);
    const expected = computeCameraForwardSpawnPosition(editor.camera, DEFAULT_SPAWN_DISTANCE);
    expect(placed.position.distanceTo(expected)).toBeLessThan(1e-4);
  });

  it('places off-center drops on the view ray through the drop point', () => {
    const editor = entityBrowserTestEditorCreate();
    const placement = placementCreate(editor, editor.camera);
    const dropPoint = {
      x: VIEWPORT_RECT.left + VIEWPORT_RECT.width * 0.8,
      y: VIEWPORT_RECT.top + VIEWPORT_RECT.height * 0.25,
    };
    const placed = placeAndFind(editor, placement, pointLightEntry(editor), dropPoint);
    const ray = viewRayThrough(editor.camera, dropPoint.x, dropPoint.y);
    expect(ray.distanceToPoint(placed.position)).toBeLessThan(1e-4);
    expect(placed.position.clone().sub(ray.origin).dot(ray.direction)).toBeGreaterThan(0);
    const centerSpawn = computeCameraForwardSpawnPosition(editor.camera, DEFAULT_SPAWN_DISTANCE);
    expect(placed.position.distanceTo(centerSpawn)).toBeGreaterThan(0.5);
  });

  it('follows the parallel rays of orthographic views', () => {
    const editor = entityBrowserTestEditorCreate();
    const topCamera = new THREE.OrthographicCamera(-10, 10, 7.5, -7.5, 0.1, 500);
    topCamera.position.set(3, 40, -2);
    topCamera.lookAt(3, 0, -2);
    topCamera.updateMatrixWorld(true);
    const placement = placementCreate(editor, topCamera);
    const dropPoint = {
      x: VIEWPORT_RECT.left + VIEWPORT_RECT.width * 0.3,
      y: VIEWPORT_RECT.top + VIEWPORT_RECT.height * 0.6,
    };
    const placed = placeAndFind(editor, placement, pointLightEntry(editor), dropPoint);
    expect(viewRayThrough(topCamera, dropPoint.x, dropPoint.y).distanceToPoint(placed.position)).toBeLessThan(1e-4);
  });

  it('places nothing outside every viewport', () => {
    const editor = entityBrowserTestEditorCreate();
    const placement = placementCreate(editor, editor.camera);
    const outside = { x: VIEWPORT_RECT.left - 10, y: VIEWPORT_RECT.top - 10 };
    expect(placement.isPlacementTarget(outside.x, outside.y)).toBe(false);
    expect(placement.place(pointLightEntry(editor), outside.x, outside.y)).toBe(false);
    expect(editor.world.children).toHaveLength(0);
  });
});
