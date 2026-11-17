import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { PrefabCatalogStore, type PrefabCatalogPersistence } from '@/prefab/prefab_catalog_store.js';
import type { PrefabTemplate } from '@/prefab/prefab_types.js';
import {
  clipboardTestBrushMeshRead,
  clipboardTestBrushAdd,
  clipboardTestModelAdd,
  clipboardTestWorldCreate,
} from '../clipboard/clipboard_test_world.js';

/**
 * Adds a named box mesh to a world.
 *
 * @param world World root.
 * @param name Object name.
 * @param position World position.
 * @returns The mesh.
 */
function namedBoxAdd(world: THREE.Object3D, name: string, position: THREE.Vector3): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3), new THREE.MeshStandardMaterial());
  mesh.name = name;
  mesh.position.copy(position);
  world.add(mesh);
  return mesh;
}

/**
 * Captures objects into a template, failing the test when nothing was captured.
 *
 * @param store Catalog store.
 * @param objects Objects to capture.
 * @returns Template.
 */
function templateCaptureOrFail(store: PrefabCatalogStore, objects: THREE.Object3D[]): PrefabTemplate {
  const template = store.templateCapture('Vault Entry', 'Doors', objects);
  if (template === null) {
    throw new Error('the test objects can be captured');
  }
  return template;
}

/** Persistence recording what it was asked to save and delete. */
class PrefabPersistenceRecorder implements PrefabCatalogPersistence {
  readonly saved: string[] = [];
  readonly deleted: string[] = [];

  /** @inheritdoc */
  templateSave(template: PrefabTemplate): void {
    this.saved.push(template.id);
  }

  /** @inheritdoc */
  templateDelete(template: PrefabTemplate): void {
    this.deleted.push(template.id);
  }
}

/** Prefabs keep full copies of objects and brushes and place scoped copies. */
describe('PrefabCatalogStore', () => {
  it('places copies whose geometry, game data and scoped entity I/O targets survive', () => {
    const testWorld = clipboardTestWorldCreate();
    const button = namedBoxAdd(testWorld.world, 'DoorButton', new THREE.Vector3(2, 0, 0));
    GameEntityComponentStore.write(button, { 'game::Button': { label: 'Open' } });
    GameEntityLogicStore.write(button, [
      { output: 'OnPressed', target: 'VaultDoor', input: 'Open', parameter: '', delay: 0.5, times_to_fire: -1 },
      { output: 'OnPressed', target: 'GlobalAlarm', input: 'Trigger', parameter: '', delay: 0, times_to_fire: 1 },
    ]);
    const door = namedBoxAdd(testWorld.world, 'VaultDoor', new THREE.Vector3(6, 0, 0));
    const store = new PrefabCatalogStore();
    const template = templateCaptureOrFail(store, [button, door]);
    store.templateAdd(template);
    const firstPayload = store.placementPayloadRead(template.id);
    const secondPayload = store.placementPayloadRead(template.id);
    if (firstPayload === null || secondPayload === null) throw new Error('the template is placeable');
    const placed = testWorld.controller.payloadPaste(firstPayload, new THREE.Vector3(0, 0, 10)).roots;
    testWorld.controller.payloadPaste(secondPayload, new THREE.Vector3(0, 0, 20));
    const placedButton = placed.find((object) => object.name.startsWith('DoorButton'));
    const placedDoor = placed.find((object) => object.name.startsWith('VaultDoor'));
    if (!(placedButton instanceof THREE.Mesh) || placedDoor === undefined) throw new Error('both objects are placed');
    const capturedSize = new THREE.Box3().setFromObject(button).getSize(new THREE.Vector3());
    expect(new THREE.Box3().setFromObject(placedButton).getSize(new THREE.Vector3())).toEqual(capturedSize);
    expect(placedButton.position.z).toBeCloseTo(button.position.z + 10);
    expect(GameEntityComponentStore.read(placedButton)).toEqual(GameEntityComponentStore.read(button));
    const targets = GameEntityLogicStore.read(placedButton).map((output) => output.target);
    expect(targets).toEqual([placedDoor.name, 'GlobalAlarm']);
    const secondDoorName = secondPayload.objects.find((entry) => entry.name.startsWith('VaultDoor'))?.name;
    expect(secondDoorName).not.toBe(placedDoor.name);
    expect(template.payload.objects.map((entry) => entry.name)).toEqual(['DoorButton', 'VaultDoor']);
  });

  it('captures brushes of a solid model and places them into the world model', () => {
    const testWorld = clipboardTestWorldCreate();
    const model = clipboardTestModelAdd(testWorld.world, 'World');
    const brush = clipboardTestBrushAdd(model, new THREE.Vector3(4, 0, 0));
    const brushMesh = clipboardTestBrushMeshRead(brush);
    const store = new PrefabCatalogStore();
    const template = templateCaptureOrFail(store, [brushMesh]);
    expect(template.payload.brushes.brushes.length).toBe(1);
    const brushCountBefore = model.getBrushes().length;
    const payload = store.placementPayloadRead(template.id) ?? template.payload;
    store.templateAdd(template);
    testWorld.controller.payloadPaste(payload, new THREE.Vector3(0, 0, 8));
    expect(model.getBrushes().length).toBe(brushCountBefore + 1);
  });

  it('derives readable unused ids from names', () => {
    const testWorld = clipboardTestWorldCreate();
    const crate = namedBoxAdd(testWorld.world, 'Crate', new THREE.Vector3());
    const store = new PrefabCatalogStore();
    const first = store.templateCapture('Shelf Row', 'Store', [crate]);
    if (first === null) throw new Error('captured');
    store.templateAdd(first);
    const second = store.templateCapture('Shelf Row', 'Store', [crate]);
    expect(first.id).toBe('shelf_row');
    expect(second?.id).toBe('shelf_row_2');
    expect(store.templateCapture('Empty', 'Store', [])).toBeNull();
  });

  it('saves and deletes through an attached persistence and swaps its prefabs when another attaches', () => {
    const testWorld = clipboardTestWorldCreate();
    const crate = namedBoxAdd(testWorld.world, 'Crate', new THREE.Vector3());
    const store = new PrefabCatalogStore();
    const sessionOnly = templateCaptureOrFail(store, [crate]);
    store.templateAdd(sessionOnly);
    const persistence = new PrefabPersistenceRecorder();
    const fromFile: PrefabTemplate = { ...sessionOnly, id: 'from_file', name: 'From file' };
    store.persistenceAttach(persistence, [fromFile]);
    expect(store.templatesRead().map((template) => template.id)).toEqual([sessionOnly.id, 'from_file']);
    const created = templateCaptureOrFail(store, [crate]);
    store.templateAdd(created);
    store.templateRemove('from_file');
    store.templateRemove(sessionOnly.id);
    expect(persistence.saved).toEqual([created.id]);
    expect(persistence.deleted).toEqual(['from_file']);
    store.persistenceAttach(null, []);
    expect(store.templatesRead()).toEqual([]);
  });
});
