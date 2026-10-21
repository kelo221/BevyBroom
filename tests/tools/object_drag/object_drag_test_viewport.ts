import * as THREE from 'three';
import { SceneRaycaster } from '@/selection/object/scene_raycaster.js';
import { ObjectDragViewport, type ObjectDragViewportSource } from '@/tools/object_drag/object_drag_viewport.js';
import { pointerClientPointOfWorld, type PointerClientPoint } from '@/utils/pointer_client_project.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';

/** Client rectangle every test viewport occupies. */
export const OBJECT_DRAG_TEST_VIEWPORT_RECT = new DOMRect(30, 20, 640, 480);

/** Half height of the orthographic test views in world units. */
const OBJECT_DRAG_TEST_ORTHO_HALF_HEIGHT = 10;

/** Distance of every test camera from the world origin. */
const OBJECT_DRAG_TEST_CAMERA_DISTANCE = 40;

/** A test viewport: the drag wrapper plus the pieces behind it. */
export interface ObjectDragTestViewport {
  viewport: ObjectDragViewport;
  source: ObjectDragViewportSource;
  camera: THREE.Camera;
  element: HTMLElement;
  meshes: THREE.Mesh[];
}

/**
 * Creates the camera of a test view looking at the world origin.
 *
 * @param kind View kind.
 * @returns Positioned camera with an updated world matrix.
 */
function objectDragTestCameraCreate(kind: ViewportKind): THREE.Camera {
  const aspect = OBJECT_DRAG_TEST_VIEWPORT_RECT.width / OBJECT_DRAG_TEST_VIEWPORT_RECT.height;
  const half = OBJECT_DRAG_TEST_ORTHO_HALF_HEIGHT;
  const camera =
    kind === ViewportKind.PERSPECTIVE
      ? new THREE.PerspectiveCamera(60, aspect, 0.1, 500)
      : new THREE.OrthographicCamera(-half * aspect, half * aspect, half, -half, 0.1, 500);
  const distance = OBJECT_DRAG_TEST_CAMERA_DISTANCE;
  if (kind === ViewportKind.PERSPECTIVE) {
    camera.position.set(distance * 0.3, distance * 0.6, distance * 0.7);
  } else if (kind === ViewportKind.TOP) {
    camera.up.set(0, 0, -1);
    camera.position.set(0, distance, 0);
  } else if (kind === ViewportKind.FRONT) {
    camera.position.set(0, 0, distance);
  } else {
    camera.position.set(distance, 0, 0);
  }
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * Creates an element that reports the test viewport rectangle.
 *
 * @returns Detached element with a fixed bounding rectangle.
 */
function objectDragTestElementCreate(): HTMLElement {
  const element = document.createElement('div');
  element.getBoundingClientRect = () => OBJECT_DRAG_TEST_VIEWPORT_RECT;
  return element;
}

/**
 * Creates a test viewport of a kind whose selectable meshes are given.
 *
 * @param kind View kind.
 * @param meshes Selectable meshes (the array is shared, later pushes count).
 * @returns Test viewport.
 */
export function objectDragTestViewportCreate(kind: ViewportKind, meshes: THREE.Mesh[] = []): ObjectDragTestViewport {
  const camera = objectDragTestCameraCreate(kind);
  const element = objectDragTestElementCreate();
  const raycaster = new SceneRaycaster();
  const source: ObjectDragViewportSource = {
    getCamera: () => camera,
    getContentElement: () => element,
    getViewportKind: () => kind,
    getObjectPickStack: (event) =>
      raycaster
        .castIntersections(camera, element, event, meshes)
        .map((hit) => hit.object)
        .filter((object): object is THREE.Mesh => object instanceof THREE.Mesh),
    getSelectableObjects: () => meshes,
  };
  return { viewport: new ObjectDragViewport(source), source, camera, element, meshes };
}

/**
 * Returns the client point over a world point in a test viewport.
 *
 * @param testViewport Test viewport.
 * @param worldPoint World point.
 * @returns Client point.
 */
export function objectDragTestClientPoint(
  testViewport: ObjectDragTestViewport,
  worldPoint: THREE.Vector3,
): PointerClientPoint {
  return pointerClientPointOfWorld(worldPoint, testViewport.camera, testViewport.element);
}

/**
 * Creates a box mesh in a world group.
 *
 * @param world Parent group.
 * @param size Box edge lengths.
 * @param center World center.
 * @returns New mesh with an updated world matrix.
 */
export function objectDragTestBoxMeshCreate(
  world: THREE.Object3D,
  size: THREE.Vector3,
  center: THREE.Vector3,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial());
  mesh.position.copy(center);
  world.add(mesh);
  mesh.updateMatrixWorld(true);
  return mesh;
}
