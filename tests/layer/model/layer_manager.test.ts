import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LAYER_DEFAULT_ID } from '@/layer/model/layer_definition.js';
import { LayerManagerLookup } from '@/layer/model/layer_manager_lookup.js';
import { LAYER_USERDATA_KEY, layerIdStoredRead } from '@/layer/model/layer_membership.js';
import { CLIP_PREVIEW_USERDATA_KEY } from '@/tools/clip_plane/clip_plane_preview.js';
import {
  layerTestBoxAddToLayer,
  layerTestBoxCreate,
  layerTestLayerAdd,
  layerTestWorldCreate,
} from '../layer_test_world.js';

/**
 * Unit tests for the layer manager: the current layer new objects join, the
 * protected default layer, object counts, document reset and replacement, and
 * change notifications.
 */
describe('LayerManager', () => {
  it('registers itself as the manager of its world', () => {
    const { world, manager } = layerTestWorldCreate();
    expect(LayerManagerLookup.find(world)).toBe(manager);
    manager.dispose();
    expect(LayerManagerLookup.find(world)).toBeNull();
  });

  it('puts objects added to the world into the current layer', () => {
    const testWorld = layerTestWorldCreate();
    const layer = layerTestLayerAdd(testWorld.manager, 'Props');
    testWorld.manager.currentLayerSet(layer.id);
    const box = layerTestBoxCreate('box');
    testWorld.world.add(box);
    expect(layerIdStoredRead(box)).toBe(layer.id);
    expect(testWorld.manager.objectCountRead(layer.id)).toBe(1);
    expect(testWorld.manager.objectCountRead(LAYER_DEFAULT_ID)).toBe(0);
  });

  it('keeps the layer an added object already stores', () => {
    const testWorld = layerTestWorldCreate();
    const layer = layerTestLayerAdd(testWorld.manager, 'Props');
    const box = layerTestBoxAddToLayer(testWorld, layer.id, 'box');
    testWorld.world.remove(box);
    testWorld.world.add(box);
    expect(layerIdStoredRead(box)).toBe(layer.id);
  });

  it('gives editor helpers and nested objects no layer of their own', () => {
    const testWorld = layerTestWorldCreate();
    const helper = new THREE.Group();
    helper.userData[CLIP_PREVIEW_USERDATA_KEY] = true;
    testWorld.world.add(helper);
    const group = new THREE.Group();
    testWorld.world.add(group);
    const nested = layerTestBoxCreate('nested');
    group.add(nested);
    expect(helper.userData[LAYER_USERDATA_KEY]).toBeUndefined();
    expect(testWorld.manager.layerOfTopLevelObjectResolve(helper)).toBeNull();
    expect(layerIdStoredRead(nested)).toBeNull();
  });

  it('protects the default layer from removal and renaming', () => {
    const { manager } = layerTestWorldCreate();
    expect(manager.layerDelete(LAYER_DEFAULT_ID)).toBe(-1);
    expect(manager.layerRename(LAYER_DEFAULT_ID, 'Renamed')).toBe(false);
    expect(manager.layersList()[0]?.id).toBe(LAYER_DEFAULT_ID);
  });

  it('makes the default layer current when the current layer is removed', () => {
    const { manager } = layerTestWorldCreate();
    const layer = layerTestLayerAdd(manager, 'Temporary');
    manager.currentLayerSet(layer.id);
    manager.layerDelete(layer.id);
    expect(manager.currentLayerIdRead()).toBe(LAYER_DEFAULT_ID);
  });

  it('resolves objects of unknown layers to the default layer', () => {
    const testWorld = layerTestWorldCreate();
    const layer = layerTestLayerAdd(testWorld.manager, 'Gone');
    const box = layerTestBoxAddToLayer(testWorld, layer.id, 'box');
    testWorld.manager.layerDelete(layer.id);
    expect(testWorld.manager.layerOfTopLevelObjectResolve(box)?.id).toBe(LAYER_DEFAULT_ID);
  });

  it('resets to the default layer and replaces layers from a document', () => {
    const { manager } = layerTestWorldCreate();
    const layer = layerTestLayerAdd(manager, 'Saved');
    const savedLayers = manager.layersList().map((definition) => ({ ...definition }));
    manager.documentReset();
    expect(manager.layersList().length).toBe(1);
    manager.documentReplace(savedLayers, layer.id);
    expect(manager.layerFind(layer.id)?.name).toBe('Saved');
    expect(manager.currentLayerIdRead()).toBe(layer.id);
  });

  it('falls back to the default layer for an unknown current layer', () => {
    const { manager } = layerTestWorldCreate();
    manager.documentReplace([], 'missing_layer');
    expect(manager.currentLayerIdRead()).toBe(LAYER_DEFAULT_ID);
  });

  it('notifies listeners of layer and membership changes', () => {
    const testWorld = layerTestWorldCreate();
    let notifications = 0;
    testWorld.manager.changeListenerAdd(() => notifications++);
    const layer = layerTestLayerAdd(testWorld.manager, 'Watched');
    const afterInsert = notifications;
    testWorld.world.add(layerTestBoxCreate('box'));
    testWorld.manager.layerFlagSet(layer.id, 'hidden', true);
    expect(afterInsert).toBeGreaterThan(0);
    expect(notifications).toBe(afterInsert + 2);
  });
});
