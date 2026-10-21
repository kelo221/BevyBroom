import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameEntityClassProviderScene } from '@/game_entity/class/game_entity_class_provider_scene.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { gameEntityClassListEmpty } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GAME_ENTITY_EXPORT_EXTRAS_KEY } from '@/game_entity/contributors/object_data_contributor_game_components.js';
import { GameEntityOwner, gameEntityCreateForClass } from '@/game_entity/owner/game_entity_owner.js';
import { buildExportScene, EXPORT_OBJECT_IDENTITY_EXTRAS_KEY } from '@/io/scene/builder_export_scene.js';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import { PreviewStateObjectCollector } from '@/preview/state/preview_state_object_collector.js';
import {
  TEST_DOOR_TYPE_PATH,
  TEST_SPINNER_TYPE_PATH,
  testClassesInstall,
  testDoorClassCreate,
} from '../game_entity_test_classes.js';

/**
 * Builds a world with a door game entity under a group and a mesh carrying a
 * spinner.
 *
 * @returns World, the game entity and the mesh.
 */
function worldCreate(): { world: THREE.Group; point: THREE.Group; mesh: THREE.Mesh } {
  const world = new THREE.Group();
  const parent = new THREE.Group();
  const point = gameEntityCreateForClass(testDoorClassCreate());
  GameEntityComponentStore.write(point, { [TEST_DOOR_TYPE_PATH]: { speed: 6, kind: 'Iron' } });
  point.position.set(3, 0, -2);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  GameEntityComponentStore.write(mesh, { [TEST_SPINNER_TYPE_PATH]: { axis: [1, 0, 0] } });
  parent.add(point);
  world.add(parent, mesh);
  return { world, point, mesh };
}

/**
 * Saves a world and loads it into a fresh world through JSON text.
 *
 * @param world Source world.
 * @returns Loaded world.
 */
function roundTrip(world: THREE.Group): THREE.Group {
  const text = JSON.stringify(new SceneSerializer().serialize(world));
  const loaded = new THREE.Group();
  new SceneDeserializer().deserialize(JSON.parse(text), loaded);
  return loaded;
}

/**
 * Game components travel with their objects through scene files, the game
 * preview and GLB export, and documents remember the classes they use.
 */
describe('ObjectDataContributorGameComponents', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    GameEntityClassProviderScene.shared.listWrite(gameEntityClassListEmpty());
  });

  it('restores game entities and components from a saved scene', () => {
    const { world, point, mesh } = worldCreate();
    const loaded = roundTrip(world);
    const restoredPoint = loaded.getObjectByProperty('uuid', point.uuid);
    const restoredMesh = loaded.getObjectByProperty('uuid', mesh.uuid);
    expect(restoredPoint && GameEntityOwner.isOwner(restoredPoint)).toBe(true);
    expect(restoredPoint && GameEntityComponentStore.read(restoredPoint)).toEqual(GameEntityComponentStore.read(point));
    expect(restoredMesh && GameEntityComponentStore.read(restoredMesh)).toEqual(GameEntityComponentStore.read(mesh));
    expect(restoredPoint?.position.distanceTo(point.position)).toBeLessThan(1e-6);
  });

  it('saves the used classes and shows them when the document opens without the game', () => {
    const { uninstall } = testClassesInstall();
    const { world } = worldCreate();
    const data = new SceneSerializer().serialize(world);
    uninstall();
    expect(data.gameClasses?.map((gameClass) => gameClass.type_path).sort()).toEqual(
      [TEST_DOOR_TYPE_PATH, TEST_SPINNER_TYPE_PATH].sort(),
    );
    expect(GameEntityClassRegistry.classFind(TEST_DOOR_TYPE_PATH)).toBeNull();
    new SceneDeserializer().deserialize(JSON.parse(JSON.stringify(data)), new THREE.Group());
    expect(GameEntityClassRegistry.classFind(TEST_DOOR_TYPE_PATH)?.fields).toEqual(testDoorClassCreate().fields);
  });

  it('loads documents written before game components existed', () => {
    const { world } = worldCreate();
    const data = new SceneSerializer().serialize(world);
    const older = { ...data, version: 5, gameClasses: undefined };
    older.objects = older.objects.map(({ gameComponents: _dropped, ...entry }) => entry);
    const loaded = new THREE.Group();
    new SceneDeserializer().deserialize(JSON.parse(JSON.stringify(older)), loaded);
    let carrying = 0;
    loaded.traverse((object) => (carrying += GameEntityComponentStore.hasAny(object) ? 1 : 0));
    expect(carrying).toBe(0);
  });

  it('sends game entities with their kind and every object with its components', () => {
    const { world, point, mesh } = worldCreate();
    const authored = PreviewStateObjectCollector.collect(world);
    const authoredPoint = authored.find((object) => object.id === point.uuid);
    expect(authoredPoint?.kind).toBe('game_entity');
    expect(authoredPoint?.components).toEqual(GameEntityComponentStore.read(point));
    expect(authored.find((object) => object.id === mesh.uuid)?.components).toEqual(GameEntityComponentStore.read(mesh));
    expect(authored.filter((object) => object.components === undefined).length).toBeGreaterThan(0);
  });

  it('exports game entities as empty nodes and components as extras only when asked', () => {
    const { world, point, mesh } = worldCreate();
    const exported = buildExportScene(world, { includeGameComponents: true });
    const nodeOf = (identifier: string): THREE.Object3D | undefined =>
      exported
        .getObjectsByProperty('type', 'Group')
        .find((node) => node.userData[EXPORT_OBJECT_IDENTITY_EXTRAS_KEY] === identifier) ??
      exported
        .getObjectsByProperty('type', 'Mesh')
        .find((node) => node.userData[EXPORT_OBJECT_IDENTITY_EXTRAS_KEY] === identifier);
    expect(nodeOf(point.uuid)?.children).toHaveLength(0);
    expect(nodeOf(point.uuid)?.userData[GAME_ENTITY_EXPORT_EXTRAS_KEY]).toEqual(GameEntityComponentStore.read(point));
    expect(nodeOf(mesh.uuid)?.userData[GAME_ENTITY_EXPORT_EXTRAS_KEY]).toEqual(GameEntityComponentStore.read(mesh));
    const plain = buildExportScene(world);
    let extrasCount = 0;
    plain.traverse((node) => (extrasCount += node.userData[GAME_ENTITY_EXPORT_EXTRAS_KEY] === undefined ? 0 : 1));
    expect(extrasCount).toBe(0);
  });
});
