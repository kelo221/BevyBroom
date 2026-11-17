import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LayerManager } from '@/layer/model/layer_manager.js';
import { LevelExportObjectFilter } from '@/level_export/level_export_object_filter.js';

/** Level exports keep hidden objects and leave out omitted layers. */
describe('LevelExportObjectFilter', () => {
  it('keeps hidden objects and drops objects in layers left out of exports', () => {
    const world = new THREE.Group();
    const layers = new LayerManager(world);
    const hidden = new THREE.Group();
    hidden.visible = false;
    const omitted = new THREE.Group();
    const child = new THREE.Group();
    omitted.add(child);
    world.add(hidden, omitted);
    const layer = layers.layerDefinitionAllocate();
    layers.layerInsert(layer, layers.layersList().length);
    layers.layerFlagSet(layer.id, 'omitFromExport', true);
    layers.objectsLayerAssign([omitted], layer.id);
    expect(LevelExportObjectFilter.exportedIs(hidden, world)).toBe(true);
    expect(LevelExportObjectFilter.exportedIs(child, world)).toBe(false);
  });
});
