import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { CLIPBOARD_PASTE_SOLID_MODEL_NAME } from '@/clipboard/controller/controller_clipboard.js';
import {
  clipboardTestBrushAdd,
  clipboardTestBrushMeshRead,
  clipboardTestCopy,
  clipboardTestModelAdd,
  clipboardTestSelect,
  clipboardTestSolidModelFind,
  clipboardTestWorldCreate,
  clipboardTestWorldPositionRead,
  type ClipboardTestWorld,
} from '../clipboard_test_world.js';

/**
 * Adds a point light to a test world.
 *
 * @param testWorld Test world.
 * @param position Light position.
 * @returns The light.
 */
function lightAdd(testWorld: ClipboardTestWorld, position: THREE.Vector3): THREE.Object3D {
  const light = LightOwner.create('Lamp', lightSettingsCreateDefault('point'));
  light.position.copy(position);
  testWorld.world.add(light);
  return light;
}

/**
 * Builds a top-down orthographic view whose center sits over a world point.
 *
 * @param center World point under the middle of the view.
 * @returns Camera and an element standing in for the view.
 */
function orthographicTopViewCreate(center: THREE.Vector3): { camera: THREE.Camera; pickElement: HTMLElement } {
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000);
  camera.position.set(center.x, 100, center.z);
  camera.lookAt(center.x, 0, center.z);
  camera.updateMatrixWorld();
  return { camera, pickElement: document.createElement('div') };
}

/**
 * Clipboard controller: copy, cut and paste as single undoable steps that
 * select what they paste.
 */
describe('ControllerClipboard', () => {
  it('reports nothing to copy or cut when nothing is selected', () => {
    const testWorld = clipboardTestWorldCreate();
    expect(testWorld.controller.copy()).toBeNull();
    expect(testWorld.controller.cut()).toBeNull();
    expect(testWorld.controller.selectionHasObjectsIs()).toBe(false);
    expect(testWorld.statusMessages).toEqual(['Nothing to copy', 'Nothing to cut']);
    expect(testWorld.commandStack.canUndo()).toBe(false);
  });

  it('copies without changing the scene and remembers the text', () => {
    const testWorld = clipboardTestWorldCreate();
    const light = lightAdd(testWorld, new THREE.Vector3(1, 1, 1));
    const text = clipboardTestCopy(testWorld, [light]);
    expect(testWorld.controller.lastCopiedTextRead()).toBe(text);
    expect(testWorld.world.children).toEqual([light]);
    expect(testWorld.commandStack.canUndo()).toBe(false);
    expect(testWorld.statusMessages).toContain('Copied 1 object(s)');
  });

  it('pastes as one undo step that selects the pasted objects and redoes with the same ids', () => {
    const testWorld = clipboardTestWorldCreate();
    const light = lightAdd(testWorld, new THREE.Vector3(0, 2, 0));
    const pasted = testWorld.controller.pasteAtOriginalPosition(clipboardTestCopy(testWorld, [light]));
    const pastedLight = pasted?.roots[0];
    expect(pastedLight).toBeDefined();
    if (pastedLight === undefined) return;
    expect(testWorld.selectionManager.getInspectorObjects()).toEqual([pastedLight]);
    testWorld.commandStack.undo();
    expect(pastedLight.parent).toBeNull();
    expect(testWorld.commandStack.canUndo()).toBe(false);
    testWorld.commandStack.redo();
    expect(pastedLight.parent).toBe(testWorld.world);
    expect(testWorld.world.getObjectByProperty('uuid', pasted?.ids[0] ?? '')).toBe(pastedLight);
  });

  it('restores pasted brushes with the same ids on redo', () => {
    const testWorld = clipboardTestWorldCreate();
    const model = clipboardTestModelAdd(testWorld.world, 'Level');
    const brushMesh = clipboardTestBrushMeshRead(clipboardTestBrushAdd(model, new THREE.Vector3(0, 1, 0)));
    const pasted = testWorld.controller.pasteAtOriginalPosition(clipboardTestCopy(testWorld, [brushMesh]));
    const pastedId = pasted?.ids[0] ?? '';
    expect(model.findBrush(pastedId)).toBeDefined();
    testWorld.commandStack.undo();
    expect(model.findBrush(pastedId)).toBeUndefined();
    expect(model.getBrushCount()).toBe(1);
    testWorld.commandStack.redo();
    expect(model.findBrush(pastedId)).toBeDefined();
    expect(model.getBrushCount()).toBe(2);
  });

  it('cuts as one undo step that brings the objects back', () => {
    const testWorld = clipboardTestWorldCreate();
    const model = clipboardTestModelAdd(testWorld.world, 'Level');
    const brush = clipboardTestBrushAdd(model, new THREE.Vector3(3, 0, 0));
    const light = lightAdd(testWorld, new THREE.Vector3(0, 4, 0));
    clipboardTestSelect(testWorld, [clipboardTestBrushMeshRead(brush), light]);
    const cut = testWorld.controller.cut();
    expect(cut?.count).toBe(2);
    expect(light.parent).toBeNull();
    expect(model.findBrush(brush.id)).toBeUndefined();
    testWorld.commandStack.undo();
    expect(testWorld.commandStack.canUndo()).toBe(false);
    expect(light.parent).toBe(testWorld.world);
    expect(model.findBrush(brush.id)).toBeDefined();
    expect(testWorld.controller.pasteAtOriginalPosition(cut?.text ?? '')?.roots).toHaveLength(2);
  });

  it('rejects text that holds no editor objects without touching the history', () => {
    const testWorld = clipboardTestWorldCreate();
    expect(testWorld.controller.pasteAtCursor('just some words')).toBeNull();
    expect(testWorld.controller.pasteAtOriginalPosition('{"format":"other"}')).toBeNull();
    expect(testWorld.commandStack.canUndo()).toBe(false);
    expect(testWorld.statusMessages).toEqual([
      'The clipboard holds no BevyBroom objects',
      'The clipboard holds no BevyBroom objects',
    ]);
  });

  it('creates a World solid model for brushes pasted into a world without one, undone in one step', () => {
    const sourceWorld = clipboardTestWorldCreate();
    const model = clipboardTestModelAdd(sourceWorld.world, 'Level');
    const brushMesh = clipboardTestBrushMeshRead(clipboardTestBrushAdd(model, new THREE.Vector3(0, 0, 0)));
    const text = clipboardTestCopy(sourceWorld, [brushMesh]);
    const emptyWorld = clipboardTestWorldCreate();
    emptyWorld.controller.pasteAtOriginalPosition(text);
    const createdModel = clipboardTestSolidModelFind(emptyWorld.world);
    expect(createdModel?.root.name).toBe(CLIPBOARD_PASTE_SOLID_MODEL_NAME);
    expect(createdModel?.getBrushCount()).toBe(1);
    emptyWorld.commandStack.undo();
    expect(emptyWorld.world.children.filter((child) => SolidModel.isSolidModelObject(child))).toHaveLength(0);
    expect(emptyWorld.commandStack.canUndo()).toBe(false);
  });

  it('pastes under the pointer of a 2D view on the grid while keeping the depth', () => {
    const testWorld = clipboardTestWorldCreate();
    const light = lightAdd(testWorld, new THREE.Vector3(1, 3, 2));
    const text = clipboardTestCopy(testWorld, [light]);
    const pointerTarget = new THREE.Vector3(7.3, 0, -4.8);
    testWorld.viewportPoint = { ...orthographicTopViewCreate(pointerTarget), clientX: 0.5, clientY: 0.5 };
    testWorld.gridInterval = 1;
    const pastedLight = testWorld.controller.pasteAtCursor(text)?.roots[0];
    expect(pastedLight).toBeDefined();
    if (pastedLight === undefined) return;
    const pastedPosition = clipboardTestWorldPositionRead(pastedLight);
    expect(pastedPosition.y).toBeCloseTo(light.position.y, 6);
    expect(Math.abs(pastedPosition.x - pointerTarget.x)).toBeLessThanOrEqual(testWorld.gridInterval / 2);
    expect(Math.abs(pastedPosition.z - pointerTarget.z)).toBeLessThanOrEqual(testWorld.gridInterval / 2);
    const offset = pastedPosition.clone().sub(light.position);
    expect(offset.x / testWorld.gridInterval).toBeCloseTo(Math.round(offset.x / testWorld.gridInterval), 6);
    expect(offset.z / testWorld.gridInterval).toBeCloseTo(Math.round(offset.z / testWorld.gridInterval), 6);
  });

  it('pastes at the copied position when no view is under the pointer', () => {
    const testWorld = clipboardTestWorldCreate();
    const light = lightAdd(testWorld, new THREE.Vector3(-2, 1, 5));
    const pastedLight = testWorld.controller.pasteAtCursor(clipboardTestCopy(testWorld, [light]))?.roots[0];
    expect(pastedLight && clipboardTestWorldPositionRead(pastedLight).distanceTo(light.position)).toBeLessThan(1e-6);
  });
});
