import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityOwner, gameEntityCreateForClass } from '@/game_entity/owner/game_entity_owner.js';
import { layerIdStoredRead } from '@/layer/model/layer_membership.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { markAsSolidCsgGroup, isSolidCsgGroup } from '@/solid/model/solid_group.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidBrushVisual } from '@/solid/model/solid_brush_visual.js';
import type { ClipboardPasteResult } from '@/clipboard/controller/controller_clipboard.js';
import { TEST_DOOR_TYPE_PATH, testDoorClassCreate } from '../../game_entity/game_entity_test_classes.js';
import { layerTestLayerAdd } from '../../layer/layer_test_world.js';
import {
  clipboardTestBrushAdd,
  clipboardTestBrushMeshRead,
  clipboardTestCopy,
  clipboardTestModelAdd,
  clipboardTestWorldCreate,
  clipboardTestWorldPositionRead,
  type ClipboardTestWorld,
} from '../clipboard_test_world.js';

/**
 * Pastes text at its copied position and fails the test when nothing was
 * pasted.
 *
 * @param testWorld Test world.
 * @param text Clipboard text.
 * @returns Paste result.
 */
function pasteAtOriginal(testWorld: ClipboardTestWorld, text: string): ClipboardPasteResult {
  const pasted = testWorld.controller.pasteAtOriginalPosition(text);
  if (pasted === null) {
    throw new Error('Nothing was pasted');
  }
  return pasted;
}

/**
 * Returns the only pasted root, failing the test when there is not exactly one.
 *
 * @param pasted Paste result.
 * @returns The pasted root.
 */
function pastedSingleRootRead(pasted: ClipboardPasteResult): THREE.Object3D {
  expect(pasted.roots).toHaveLength(1);
  const root = pasted.roots[0];
  if (root === undefined) {
    throw new Error('No root was pasted');
  }
  return root;
}

/**
 * Builds a solid CSG group holding two brushes under a model.
 *
 * @param model Solid model receiving the group.
 * @returns The group.
 */
function csgGroupWithTwoBrushesCreate(model: SolidModel): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Pillars';
  markAsSolidCsgGroup(group);
  group.position.set(2, 0, 0);
  model.root.add(group);
  clipboardTestBrushAdd(model, new THREE.Vector3(0, 1, 0), group);
  clipboardTestBrushAdd(model, new THREE.Vector3(0, 1, 4), group);
  return group;
}

/**
 * Returns the world positions of the brush meshes under an object, in scene
 * order.
 *
 * @param root Object whose brush meshes are read.
 * @returns World positions.
 */
function brushWorldPositionsRead(root: THREE.Object3D): THREE.Vector3[] {
  const positions: THREE.Vector3[] = [];
  root.traverse((child) => {
    if (SolidBrushVisual.getBrushId(child) !== null && child !== root) {
      positions.push(clipboardTestWorldPositionRead(child));
    }
  });
  return positions;
}

/**
 * Copy then paste at the original position recreates each kind of object with
 * new ids at the same world place.
 */
describe('clipboard payload round trip', () => {
  it('pastes a brush with a new id at the same world position', () => {
    const testWorld = clipboardTestWorldCreate();
    const model = clipboardTestModelAdd(testWorld.world, 'Level');
    model.root.position.set(5, 0, -3);
    const brush = clipboardTestBrushAdd(model, new THREE.Vector3(1, 2, 3));
    const brushMesh = clipboardTestBrushMeshRead(brush);
    const pasted = pasteAtOriginal(testWorld, clipboardTestCopy(testWorld, [brushMesh]));
    const pastedId = pasted.ids[0] ?? '';
    expect(pastedId).not.toBe(brush.id);
    const pastedBrush = model.findBrush(pastedId);
    expect(pastedBrush).toBeDefined();
    const pastedMesh = pastedBrush?.mesh ?? null;
    expect(pastedMesh?.parent).toBe(model.root);
    expect(
      pastedMesh && clipboardTestWorldPositionRead(pastedMesh).distanceTo(clipboardTestWorldPositionRead(brushMesh)),
    ).toBeLessThan(1e-6);
    expect(model.getBrushCount()).toBe(2);
  });

  it('pastes a CSG group with fresh ids and its brushes at the same world positions', () => {
    const testWorld = clipboardTestWorldCreate();
    const model = clipboardTestModelAdd(testWorld.world, 'Level');
    const group = csgGroupWithTwoBrushesCreate(model);
    const pastedGroup = pastedSingleRootRead(pasteAtOriginal(testWorld, clipboardTestCopy(testWorld, [group])));
    expect(isSolidCsgGroup(pastedGroup)).toBe(true);
    expect(pastedGroup.uuid).not.toBe(group.uuid);
    expect(pastedGroup.parent).toBe(model.root);
    const sourcePositions = brushWorldPositionsRead(group);
    const pastedPositions = brushWorldPositionsRead(pastedGroup);
    expect(pastedPositions).toHaveLength(sourcePositions.length);
    pastedPositions.forEach((position, index) =>
      expect(position.distanceTo(sourcePositions[index] ?? new THREE.Vector3(NaN))).toBeLessThan(1e-6),
    );
    expect(model.getBrushCount()).toBe(4);
  });

  it('pastes a whole solid model as a new model with new brush ids', () => {
    const testWorld = clipboardTestWorldCreate();
    const model = clipboardTestModelAdd(testWorld.world, 'Level');
    model.root.position.set(0, 3, 0);
    const brush = clipboardTestBrushAdd(model, new THREE.Vector3(4, 0, 0));
    const pastedRoot = pastedSingleRootRead(pasteAtOriginal(testWorld, clipboardTestCopy(testWorld, [model.root])));
    expect(SolidModel.isSolidModelObject(pastedRoot)).toBe(true);
    expect(pastedRoot.uuid).not.toBe(model.root.uuid);
    const pastedModel = SolidModel.fromObject(pastedRoot);
    const pastedBrush = pastedModel?.getBrushes()[0];
    expect(pastedModel?.getBrushCount()).toBe(1);
    expect(pastedBrush?.id).not.toBe(brush.id);
    const pastedMesh = pastedBrush?.mesh ?? null;
    const sourcePosition = clipboardTestWorldPositionRead(clipboardTestBrushMeshRead(brush));
    expect(pastedMesh && clipboardTestWorldPositionRead(pastedMesh).distanceTo(sourcePosition)).toBeLessThan(1e-6);
  });

  it('pastes a light with a new id and the same settings', () => {
    const testWorld = clipboardTestWorldCreate();
    const light = LightOwner.create('Lamp', { ...lightSettingsCreateDefault('spot'), radius: 7.5 });
    light.position.set(1, 2, 3);
    testWorld.world.add(light);
    const pastedLight = pastedSingleRootRead(pasteAtOriginal(testWorld, clipboardTestCopy(testWorld, [light])));
    expect(pastedLight.uuid).not.toBe(light.uuid);
    expect(pastedLight.parent).toBe(testWorld.world);
    expect(LightOwner.settingsRead(pastedLight)).toEqual(LightOwner.settingsRead(light));
    expect(pastedLight.position.distanceTo(light.position)).toBeLessThan(1e-6);
  });

  it('pastes a game entity with its components into the current layer', () => {
    const testWorld = clipboardTestWorldCreate();
    const sourceLayer = layerTestLayerAdd(testWorld.layerManager, 'Doors');
    const pasteLayer = layerTestLayerAdd(testWorld.layerManager, 'Copies');
    testWorld.layerManager.currentLayerSet(sourceLayer.id);
    const door = gameEntityCreateForClass(testDoorClassCreate());
    GameEntityComponentStore.write(door, { [TEST_DOOR_TYPE_PATH]: { speed: 6, kind: 'Iron' } });
    door.position.set(-2, 0, 4);
    testWorld.world.add(door);
    const text = clipboardTestCopy(testWorld, [door]);
    testWorld.layerManager.currentLayerSet(pasteLayer.id);
    const pastedDoor = pastedSingleRootRead(pasteAtOriginal(testWorld, text));
    expect(GameEntityOwner.isOwner(pastedDoor)).toBe(true);
    expect(pastedDoor.uuid).not.toBe(door.uuid);
    expect(GameEntityComponentStore.read(pastedDoor)).toEqual(GameEntityComponentStore.read(door));
    expect(layerIdStoredRead(door)).toBe(sourceLayer.id);
    expect(layerIdStoredRead(pastedDoor)).toBe(pasteLayer.id);
  });

  it('keeps the world position of brushes pasted into a differently placed model', () => {
    const testWorld = clipboardTestWorldCreate();
    const targetModel = clipboardTestModelAdd(testWorld.world, 'Target');
    targetModel.root.position.set(10, -1, 6);
    targetModel.root.rotation.set(0, Math.PI / 3, 0);
    const sourceModel = clipboardTestModelAdd(testWorld.world, 'Source');
    sourceModel.root.position.set(-4, 2, 0);
    const brushMesh = clipboardTestBrushMeshRead(clipboardTestBrushAdd(sourceModel, new THREE.Vector3(1, 0, 2)));
    const pasted = pasteAtOriginal(testWorld, clipboardTestCopy(testWorld, [brushMesh]));
    const pastedBrush = targetModel.findBrush(pasted.ids[0] ?? '');
    const pastedMesh = pastedBrush?.mesh ?? null;
    expect(pastedMesh?.parent).toBe(targetModel.root);
    const sourcePosition = clipboardTestWorldPositionRead(brushMesh);
    expect(pastedMesh && clipboardTestWorldPositionRead(pastedMesh).distanceTo(sourcePosition)).toBeLessThan(1e-6);
  });
});
