import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SceneRaycaster } from '@/selection/object/scene_raycaster.js';
import { RaycasterFaceSelection } from '@/selection/face/raycaster_face_selection.js';
import { layerTestBoxAddToLayer, layerTestLayerAdd, layerTestWorldCreate } from '../../layer/layer_test_world.js';

/** Size of the simulated pick element in pixels. */
const PICK_ELEMENT_SIZE = { width: 640, height: 480 };

/**
 * Creates a pick element with a fixed client rectangle.
 *
 * @returns Pick element.
 */
function pickElementCreate(): HTMLElement {
  const element = document.createElement('div');
  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, ...PICK_ELEMENT_SIZE, right: PICK_ELEMENT_SIZE.width }),
  });
  return element;
}

/**
 * Creates a camera aimed at an object from a distance along +Z.
 *
 * @param target Object the camera looks at.
 * @returns Camera with current matrices.
 */
function cameraAimedAt(target: THREE.Object3D): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(60, PICK_ELEMENT_SIZE.width / PICK_ELEMENT_SIZE.height, 0.1, 100);
  const targetPosition = target.getWorldPosition(new THREE.Vector3());
  camera.position.copy(targetPosition).add(new THREE.Vector3(0, 0, 5));
  camera.lookAt(targetPosition);
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * Creates a click at the center of the pick element, where the camera aims.
 *
 * @returns Mouse event.
 */
function centerClickCreate(): MouseEvent {
  return new MouseEvent('click', { clientX: PICK_ELEMENT_SIZE.width / 2, clientY: PICK_ELEMENT_SIZE.height / 2 });
}

/**
 * Unit tests for picking with layers: meshes in hidden or locked layers cannot
 * be clicked, and meshes in hidden layers cannot have their faces picked.
 */
describe('picking with layers', () => {
  it.each(['hidden', 'locked'] as const)('does not click meshes of %s layers', (flag) => {
    const testWorld = layerTestWorldCreate();
    const layer = layerTestLayerAdd(testWorld.manager, 'Blocked');
    const box = layerTestBoxAddToLayer(testWorld, layer.id, 'box');
    testWorld.world.updateMatrixWorld(true);
    const raycaster = new SceneRaycaster();
    const camera = cameraAimedAt(box);
    expect(raycaster.cast(camera, pickElementCreate(), centerClickCreate(), [box])).toBe(box);
    testWorld.manager.layerFlagSet(layer.id, flag, true);
    expect(raycaster.cast(camera, pickElementCreate(), centerClickCreate(), [box])).toBeNull();
  });

  it('does not pick faces of meshes in hidden layers', () => {
    const testWorld = layerTestWorldCreate();
    const layer = layerTestLayerAdd(testWorld.manager, 'Hidden');
    const box = layerTestBoxAddToLayer(testWorld, layer.id, 'box');
    testWorld.world.updateMatrixWorld(true);
    const raycaster = new RaycasterFaceSelection();
    const camera = cameraAimedAt(box);
    expect(raycaster.pickFace(centerClickCreate(), camera, pickElementCreate(), [box])?.mesh).toBe(box);
    testWorld.manager.layerFlagSet(layer.id, 'hidden', true);
    expect(raycaster.pickFace(centerClickCreate(), camera, pickElementCreate(), [box])).toBeNull();
  });
});
