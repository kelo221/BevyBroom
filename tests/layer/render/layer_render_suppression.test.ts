import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LayerRenderSuppression } from '@/layer/render/layer_render_suppression.js';
import { layerTestBoxAddToLayer, layerTestLayerAdd, layerTestWorldCreate } from '../layer_test_world.js';

/**
 * Calls the before-render and after-render callbacks of a scene the way the
 * renderer does around one draw, and reports what was visible during it.
 *
 * @param scene Scene being drawn.
 * @param objects Objects whose visibility during the draw is recorded.
 * @returns Visibility of each object while the scene was drawn.
 */
function sceneDrawSimulate(scene: THREE.Scene, objects: readonly THREE.Object3D[]): boolean[] {
  const renderer = {} as THREE.WebGLRenderer;
  const camera = new THREE.PerspectiveCamera();
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.MeshBasicMaterial();
  scene.onBeforeRender(renderer, scene, camera, geometry, material, null as unknown as THREE.Group);
  const visibleDuringDraw = objects.map((object) => object.visible);
  scene.onAfterRender(renderer, scene, camera, geometry, material, null as unknown as THREE.Group);
  return visibleDuringDraw;
}

/**
 * Unit tests for the render suppression of hidden layers: objects of hidden
 * layers are invisible only while a picture is drawn, their saved visibility
 * never changes, and the hook follows the world into the scene that holds it.
 */
describe('LayerRenderSuppression', () => {
  it('hides objects of hidden layers only while the scene is drawn', () => {
    const testWorld = layerTestWorldCreate();
    const scene = new THREE.Scene();
    scene.add(testWorld.world);
    const suppression = new LayerRenderSuppression(testWorld.manager);
    const layer = layerTestLayerAdd(testWorld.manager, 'Hidden');
    const hiddenBox = layerTestBoxAddToLayer(testWorld, layer.id, 'hidden');
    const shownBox = layerTestBoxAddToLayer(testWorld, testWorld.manager.layerDefaultRead().id, 'shown');
    testWorld.manager.layerFlagSet(layer.id, 'hidden', true);
    expect(sceneDrawSimulate(scene, [hiddenBox, shownBox])).toEqual([false, true]);
    expect(hiddenBox.visible).toBe(true);
    suppression.dispose();
  });

  it('keeps objects the user hid hidden after the draw', () => {
    const testWorld = layerTestWorldCreate();
    const scene = new THREE.Scene();
    scene.add(testWorld.world);
    const suppression = new LayerRenderSuppression(testWorld.manager);
    const layer = layerTestLayerAdd(testWorld.manager, 'Hidden');
    const userHiddenBox = layerTestBoxAddToLayer(testWorld, layer.id, 'user hidden');
    userHiddenBox.visible = false;
    testWorld.manager.layerFlagSet(layer.id, 'hidden', true);
    sceneDrawSimulate(scene, [userHiddenBox]);
    expect(userHiddenBox.visible).toBe(false);
    suppression.dispose();
  });

  it('keeps calling the callbacks the scene had before', () => {
    const testWorld = layerTestWorldCreate();
    const scene = new THREE.Scene();
    const calls: string[] = [];
    scene.onBeforeRender = () => calls.push('before');
    scene.onAfterRender = () => calls.push('after');
    scene.add(testWorld.world);
    const suppression = new LayerRenderSuppression(testWorld.manager);
    sceneDrawSimulate(scene, []);
    suppression.dispose();
    sceneDrawSimulate(scene, []);
    expect(calls).toEqual(['before', 'after', 'before', 'after']);
  });

  it('follows the world into another scene and releases the old one', () => {
    const testWorld = layerTestWorldCreate();
    const firstScene = new THREE.Scene();
    const secondScene = new THREE.Scene();
    const originalCallback = firstScene.onBeforeRender;
    firstScene.add(testWorld.world);
    const suppression = new LayerRenderSuppression(testWorld.manager);
    expect(suppression.hookedSceneRead()).toBe(firstScene);
    secondScene.add(testWorld.world);
    expect(suppression.hookedSceneRead()).toBe(secondScene);
    expect(firstScene.onBeforeRender).toBe(originalCallback);
    suppression.dispose();
  });
});
