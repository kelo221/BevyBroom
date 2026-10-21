import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { selectableMeshHelperIs, selectableMeshesCollect } from '@/selection/object/selectable_mesh_filter.js';
import { ManagerViewportSync } from '@/layout/viewport/manager_viewport_sync.js';
import { CLIP_PREVIEW_USERDATA_KEY } from '@/tools/clip_plane/clip_plane_preview.js';
import {
  layerTestBoxAddToLayer,
  layerTestBoxCreate,
  layerTestLayerAdd,
  layerTestWorldCreate,
} from '../../layer/layer_test_world.js';

/**
 * Unit tests for the selectable mesh pool: helpers and meshes in hidden or
 * locked layers are left out, and the viewport sync manager uses the same pool
 * for every viewport.
 */
describe('selectable_mesh_filter', () => {
  it('treats overlays and clip preview parts as helpers', () => {
    const preview = new THREE.Group();
    preview.userData[CLIP_PREVIEW_USERDATA_KEY] = true;
    const previewPart = layerTestBoxCreate('preview part');
    preview.add(previewPart);
    const overlay = layerTestBoxCreate('overlay');
    overlay.userData['isWireframeOverlay'] = true;
    expect(selectableMeshHelperIs(previewPart)).toBe(true);
    expect(selectableMeshHelperIs(overlay)).toBe(true);
    expect(selectableMeshHelperIs(layerTestBoxCreate('content'))).toBe(false);
  });

  it.each(['hidden', 'locked'] as const)('leaves meshes of %s layers out of the pool', (flag) => {
    const testWorld = layerTestWorldCreate();
    const layer = layerTestLayerAdd(testWorld.manager, 'Blocked');
    const group = new THREE.Group();
    testWorld.manager.currentLayerSet(layer.id);
    testWorld.world.add(group);
    const nested = layerTestBoxCreate('nested');
    group.add(nested);
    const free = layerTestBoxAddToLayer(testWorld, testWorld.manager.layerDefaultRead().id, 'free');
    expect(selectableMeshesCollect(testWorld.world)).toEqual([nested, free]);
    testWorld.manager.layerFlagSet(layer.id, flag, true);
    expect(selectableMeshesCollect(testWorld.world)).toEqual([free]);
  });

  it('gives the viewport sync manager the same pool', () => {
    const testWorld = layerTestWorldCreate();
    const layer = layerTestLayerAdd(testWorld.manager, 'Hidden');
    layerTestBoxAddToLayer(testWorld, layer.id, 'hidden');
    const free = layerTestBoxAddToLayer(testWorld, testWorld.manager.layerDefaultRead().id, 'free');
    testWorld.manager.layerFlagSet(layer.id, 'hidden', true);
    const sync = new ManagerViewportSync(null, null, null, null);
    sync.setWorldObject(testWorld.world);
    expect(sync.getWorldSelectableMeshes()).toEqual([free]);
  });
});
