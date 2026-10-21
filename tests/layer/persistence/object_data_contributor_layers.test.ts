import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import type { SceneJSON } from '@/io/scene/io_types.js';
import { buildExportScene } from '@/io/scene/builder_export_scene.js';
import { PreviewStateObjectCollector } from '@/preview/state/preview_state_object_collector.js';
import { PreviewGeometrySignature } from '@/preview/geometry/preview_geometry_signature.js';
import { CommandObjectDuplicate } from '@/outliner/commands/command_object_duplicate.js';
import { CommandEntityDuplicate } from '@/entity/commands/command_entity_duplicate.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { LAYER_DEFAULT_ID } from '@/layer/model/layer_definition.js';
import { layerIdStoredRead } from '@/layer/model/layer_membership.js';
import { layerTestBoxAddToLayer, layerTestLayerAdd, layerTestWorldCreate } from '../layer_test_world.js';

/**
 * Writes a world to scene file text and loads it into a fresh managed world.
 *
 * @param world World to save.
 * @returns Saved scene and the loaded world with its manager.
 */
function sceneRoundTrip(world: THREE.Group): { saved: SceneJSON; loaded: ReturnType<typeof layerTestWorldCreate> } {
  const saved = JSON.parse(JSON.stringify(new SceneSerializer().serialize(world))) as SceneJSON;
  const loaded = layerTestWorldCreate();
  new SceneDeserializer().deserialize(saved, loaded.world);
  return { saved, loaded };
}

/**
 * Unit tests for the layers object data contributor: layers survive scene
 * files, old files load into the default layer, duplicates keep their layer,
 * hidden layers reach the game as hidden and omitted layers are left out of
 * exports and the game preview.
 */
describe('ObjectDataContributorLayers', () => {
  it('round-trips layers, switches, the current layer and memberships', () => {
    const source = layerTestWorldCreate();
    const layer = layerTestLayerAdd(source.manager, 'Saved');
    source.manager.layerFlagSet(layer.id, 'locked', true);
    const box = layerTestBoxAddToLayer(source, layer.id, 'box');
    source.manager.currentLayerSet(layer.id);
    const { saved, loaded } = sceneRoundTrip(source.world);
    expect(saved.layers?.map((definition) => definition.id)).toEqual([LAYER_DEFAULT_ID, layer.id]);
    expect(loaded.manager.layerFind(layer.id)).toEqual(source.manager.layerFind(layer.id));
    expect(loaded.manager.currentLayerIdRead()).toBe(layer.id);
    const loadedBox = loaded.world.getObjectByProperty('uuid', box.uuid);
    expect(loadedBox ? layerIdStoredRead(loadedBox) : null).toBe(layer.id);
  });

  it('loads a version 6 file without layers into the default layer', () => {
    const source = layerTestWorldCreate();
    const box = layerTestBoxAddToLayer(source, layerTestLayerAdd(source.manager, 'New').id, 'box');
    const saved = JSON.parse(JSON.stringify(new SceneSerializer().serialize(source.world))) as SceneJSON;
    const oldFile: SceneJSON = { version: 6, objects: saved.objects.map(({ layer: _layer, ...entry }) => entry) };
    const loaded = layerTestWorldCreate();
    layerTestLayerAdd(loaded.manager, 'Left over');
    new SceneDeserializer().deserialize(oldFile, loaded.world);
    expect(loaded.manager.layersList().map((definition) => definition.id)).toEqual([LAYER_DEFAULT_ID]);
    const loadedBox = loaded.world.getObjectByProperty('uuid', box.uuid);
    expect(loadedBox ? loaded.manager.layerOfTopLevelObjectResolve(loadedBox)?.id : null).toBe(LAYER_DEFAULT_ID);
  });

  it('keeps the source layer on duplicated meshes and entities', () => {
    const testWorld = layerTestWorldCreate();
    const layer = layerTestLayerAdd(testWorld.manager, 'Source');
    const box = layerTestBoxAddToLayer(testWorld, layer.id, 'box');
    testWorld.manager.currentLayerSet(layer.id);
    const light = LightOwner.createDefault('Lamp');
    testWorld.world.add(light);
    testWorld.manager.currentLayerSet(LAYER_DEFAULT_ID);
    const meshDuplicate = new CommandObjectDuplicate([box], testWorld.world, new THREE.Vector3(1, 0, 0));
    meshDuplicate.execute();
    const entityDuplicate = new CommandEntityDuplicate([light]);
    entityDuplicate.execute();
    const copies = testWorld.world.children.filter((child) => child !== box && child !== light);
    expect(copies.length).toBe(2);
    copies.forEach((copy) => expect(layerIdStoredRead(copy)).toBe(layer.id));
  });

  it('sends objects of hidden layers to the game as hidden without changing them', () => {
    const testWorld = layerTestWorldCreate();
    const layer = layerTestLayerAdd(testWorld.manager, 'Hidden');
    const box = layerTestBoxAddToLayer(testWorld, layer.id, 'box');
    testWorld.manager.layerFlagSet(layer.id, 'hidden', true);
    const authored = PreviewStateObjectCollector.collect(testWorld.world).find((object) => object.id === box.uuid);
    expect(authored?.visible).toBe(false);
    expect(box.visible).toBe(true);
    expect(buildExportScene(testWorld.world).children.length).toBe(1);
  });

  it('leaves objects of omitted layers out of exports and the game preview', () => {
    const testWorld = layerTestWorldCreate();
    const layer = layerTestLayerAdd(testWorld.manager, 'Omitted');
    const omittedBox = layerTestBoxAddToLayer(testWorld, layer.id, 'omitted');
    testWorld.manager.currentLayerSet(layer.id);
    const omittedLight = LightOwner.createDefault('Omitted lamp');
    testWorld.world.add(omittedLight);
    const keptBox = layerTestBoxAddToLayer(testWorld, LAYER_DEFAULT_ID, 'kept');
    const signatureBefore = PreviewGeometrySignature.compute(testWorld.world);
    testWorld.manager.layerFlagSet(layer.id, 'omitFromExport', true);
    const exportedNames = buildExportScene(testWorld.world).children.map((child) => child.name);
    const authoredIds = PreviewStateObjectCollector.collect(testWorld.world).map((object) => object.id);
    expect(exportedNames).toEqual([keptBox.name]);
    expect(authoredIds).toEqual([keptBox.uuid]);
    expect(authoredIds).not.toContain(omittedBox.uuid);
    expect(PreviewGeometrySignature.compute(testWorld.world)).not.toBe(signatureBefore);
  });
});
