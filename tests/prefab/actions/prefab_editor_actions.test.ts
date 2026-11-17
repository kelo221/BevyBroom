import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PREFAB_CATEGORY_DEFAULT } from '@/prefab/prefab_types.js';
import { clipboardTestSelect } from '../../clipboard/clipboard_test_world.js';
import {
  prefabActionsTestBoundsRead,
  prefabActionsTestBoxAdd,
  prefabActionsTestRigCreate,
  prefabActionsTestTemplateAdd,
  type PrefabActionsTestRig,
} from './prefab_actions_test_support.js';

/**
 * Captures a box standing at an arbitrary spot as a prefab, then removes the
 * box so placement rays only meet the test floor.
 *
 * @param rig Test rig.
 * @param size Box size.
 * @returns Prefab id.
 */
function prefabFromRemovedBox(rig: PrefabActionsTestRig, size: THREE.Vector3): string {
  const box = prefabActionsTestBoxAdd(rig.testWorld.world, 'Crate', size, new THREE.Vector3(-37, 11, 52));
  const template = prefabActionsTestTemplateAdd(rig, 'Crate', 'Props', [box]);
  box.removeFromParent();
  return template.id;
}

/**
 * Adds a wide floor slab whose top lies at a given height.
 *
 * @param rig Test rig.
 * @param centre Point at the middle of the floor's top face.
 * @returns Floor top height.
 */
function floorAdd(rig: PrefabActionsTestRig, centre: THREE.Vector3): number {
  const thickness = 2;
  prefabActionsTestBoxAdd(
    rig.testWorld.world,
    'Floor',
    new THREE.Vector3(60, thickness, 60),
    centre.clone().setY(centre.y - thickness),
  );
  return centre.y;
}

/**
 * Builds a perspective camera looking at a point from above and to the side.
 *
 * @param target Point in the middle of the view.
 * @returns Camera.
 */
function cameraLookingAt(target: THREE.Vector3): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.copy(target).add(new THREE.Vector3(4, 18, 9));
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return camera;
}

/** Making, placing and managing prefabs through the editor's prefab actions. */
describe('PrefabEditorActions', () => {
  it('makes a prefab from the selection with the typed name and the default category', async () => {
    const rig = prefabActionsTestRigCreate();
    const box = prefabActionsTestBoxAdd(
      rig.testWorld.world,
      'Shelf',
      new THREE.Vector3(4, 2, 1),
      new THREE.Vector3(3, 0, 5),
    );
    clipboardTestSelect(rig.testWorld, [box]);
    rig.promptAnswers.push({ name: 'Tall Shelf', category: '' });
    const template = await rig.actions.makeFromSelection();
    expect(template?.name).toBe('Tall Shelf');
    expect(template?.category).toBe(PREFAB_CATEGORY_DEFAULT);
    expect(rig.store.templatesRead().map((stored) => stored.id)).toEqual([template?.id]);
    rig.testWorld.commandStack.undo();
    expect(rig.store.templatesRead()).toHaveLength(0);
  });

  it('offers the category used last when making the next prefab', async () => {
    const rig = prefabActionsTestRigCreate();
    const box = prefabActionsTestBoxAdd(
      rig.testWorld.world,
      'Shelf',
      new THREE.Vector3(1, 1, 1),
      new THREE.Vector3(0, 0, 0),
    );
    clipboardTestSelect(rig.testWorld, [box]);
    rig.promptAnswers.push({ name: 'First', category: 'Shelves' }, { name: 'Second', category: '' });
    await rig.actions.makeFromSelection();
    const second = await rig.actions.makeFromSelection();
    const categoryField = rig.prompts[1]?.fields.find((field) => field.id === 'category');
    expect(categoryField?.value).toBe('Shelves');
    expect(categoryField?.suggestions).toContain('Shelves');
    expect(second?.category).toBe('Shelves');
  });

  it('makes nothing and asks nothing without a selection, and nothing when cancelled', async () => {
    const rig = prefabActionsTestRigCreate();
    expect(await rig.actions.makeFromSelection()).toBeNull();
    expect(rig.prompts).toHaveLength(0);
    expect(rig.statusMessages.at(-1)).toContain('Select objects');
    const box = prefabActionsTestBoxAdd(
      rig.testWorld.world,
      'Box',
      new THREE.Vector3(1, 1, 1),
      new THREE.Vector3(0, 0, 0),
    );
    clipboardTestSelect(rig.testWorld, [box]);
    expect(await rig.actions.makeFromSelection()).toBeNull();
    expect(rig.store.templatesRead()).toHaveLength(0);
    expect(rig.testWorld.commandStack.canUndo()).toBe(false);
  });

  it('places a prefab with its bottom on the floor under an aimed point, centred on it', () => {
    const rig = prefabActionsTestRigCreate();
    const size = new THREE.Vector3(3, 5, 2);
    const prefabId = prefabFromRemovedBox(rig, size);
    const aimPoint = new THREE.Vector3(14, 6, -9);
    const floorTop = floorAdd(rig, aimPoint);
    const placed = rig.actions.placeAtAim(prefabId, {
      camera: cameraLookingAt(aimPoint),
      ndc: new THREE.Vector2(0, 0),
    });
    const bounds = prefabActionsTestBoundsRead(placed?.roots ?? []);
    expect(bounds.min.y).toBeCloseTo(floorTop, 4);
    expect(bounds.getSize(new THREE.Vector3()).distanceTo(size)).toBeLessThan(1e-4);
    expect(bounds.getCenter(new THREE.Vector3()).setY(aimPoint.y).distanceTo(aimPoint)).toBeLessThan(1e-4);
  });

  it('places a prefab on the floor at the centre of a top view, or where it was captured without a view', () => {
    const rig = prefabActionsTestRigCreate();
    const prefabId = prefabFromRemovedBox(rig, new THREE.Vector3(2, 2, 2));
    const captured = rig.store.templateFind(prefabId)?.payload.bounds;
    expect(prefabActionsTestBoundsRead(rig.actions.placeAtViewCentre(prefabId)?.roots ?? []).min.y).toBeCloseTo(
      captured?.min.y ?? NaN,
      4,
    );
    const viewCentre = new THREE.Vector3(-8, 3, 21);
    const floorTop = floorAdd(rig, viewCentre);
    const camera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 5000);
    camera.position.copy(viewCentre).setY(1000);
    camera.up.set(0, 0, -1);
    camera.lookAt(viewCentre);
    camera.updateMatrixWorld();
    rig.activeCamera = camera;
    const bounds = prefabActionsTestBoundsRead(rig.actions.placeAtViewCentre(prefabId)?.roots ?? []);
    expect(bounds.min.y).toBeCloseTo(floorTop, 4);
    expect(bounds.getCenter(new THREE.Vector3()).setY(viewCentre.y).distanceTo(viewCentre)).toBeLessThan(1e-4);
  });

  it('renames and recategorizes a prefab through prompts, each undoable', async () => {
    const rig = prefabActionsTestRigCreate();
    const prefabId = prefabFromRemovedBox(rig, new THREE.Vector3(1, 1, 1));
    rig.promptAnswers.push({ name: 'Wooden Crate' }, { category: 'Storage' });
    await rig.actions.renameAsk(prefabId);
    await rig.actions.categoryChangeAsk(prefabId);
    expect(rig.prompts[0]?.fields[0]?.value).toBe('Crate');
    expect(rig.store.templateFind(prefabId)).toMatchObject({ name: 'Wooden Crate', category: 'Storage' });
    rig.testWorld.commandStack.undo();
    expect(rig.store.templateFind(prefabId)).toMatchObject({ name: 'Wooden Crate', category: 'Props' });
    rig.testWorld.commandStack.undo();
    expect(rig.store.templateFind(prefabId)).toMatchObject({ name: 'Crate', category: 'Props' });
  });

  it('deletes a prefab undoably and reveals its file, reporting a failed reveal', async () => {
    const rig = prefabActionsTestRigCreate();
    const prefabId = prefabFromRemovedBox(rig, new THREE.Vector3(1, 1, 1));
    await rig.actions.reveal(prefabId);
    expect(rig.revealedFiles).toEqual([`${prefabId}.json`]);
    rig.revealResult = { ok: false, message: 'Open a game project first' };
    await rig.actions.reveal(prefabId);
    expect(rig.statusMessages.at(-1)).toBe('Open a game project first');
    rig.actions.remove(prefabId);
    expect(rig.store.templateFind(prefabId)).toBeNull();
    rig.testWorld.commandStack.undo();
    expect(rig.store.templateFind(prefabId)?.name).toBe('Crate');
  });

  it('ties the selection to an entity group and moves it back to the world', () => {
    const rig = prefabActionsTestRigCreate();
    const boxes = [0, 1].map((index) =>
      prefabActionsTestBoxAdd(
        rig.testWorld.world,
        `Part${index}`,
        new THREE.Vector3(1, 1, 1),
        new THREE.Vector3(index * 3, 0, 0),
      ),
    );
    rig.testWorld.selectionManager.setSelection(boxes, boxes);
    rig.actions.entityTie();
    const group = boxes[0]?.parent;
    expect(group).not.toBe(rig.testWorld.world);
    expect(boxes.every((box) => box.parent === group)).toBe(true);
    rig.testWorld.commandStack.undo();
    expect(boxes.every((box) => box.parent === rig.testWorld.world)).toBe(true);
  });
});
