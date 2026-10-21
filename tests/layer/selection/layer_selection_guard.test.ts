import { describe, expect, it } from 'vitest';
import { LayerSelectionGuard } from '@/layer/selection/layer_selection_guard.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { layerTestBoxAddToLayer, layerTestLayerAdd, layerTestWorldCreate } from '../layer_test_world.js';

/**
 * Unit tests for the selection guard: hiding or locking a layer drops its
 * objects from the selection and keeps the others.
 */
describe('LayerSelectionGuard', () => {
  it.each(['hidden', 'locked'] as const)('deselects objects when their layer becomes %s', (flag) => {
    const testWorld = layerTestWorldCreate();
    const selection = new ManagerSelection();
    const guard = new LayerSelectionGuard(testWorld.manager, selection);
    const layer = layerTestLayerAdd(testWorld.manager, 'Guarded');
    const guardedBox = layerTestBoxAddToLayer(testWorld, layer.id, 'guarded');
    const freeBox = layerTestBoxAddToLayer(testWorld, testWorld.manager.layerDefaultRead().id, 'free');
    selection.setSelection([guardedBox, freeBox]);
    testWorld.manager.layerFlagSet(layer.id, flag, true);
    expect(selection.getAllSelectedObjectsAsArray()).toEqual([freeBox]);
    guard.dispose();
  });

  it('leaves the selection alone when a layer is only omitted from export', () => {
    const testWorld = layerTestWorldCreate();
    const selection = new ManagerSelection();
    const guard = new LayerSelectionGuard(testWorld.manager, selection);
    const layer = layerTestLayerAdd(testWorld.manager, 'Omitted');
    const box = layerTestBoxAddToLayer(testWorld, layer.id, 'box');
    selection.setSelection([box]);
    testWorld.manager.layerFlagSet(layer.id, 'omitFromExport', true);
    expect(selection.getAllSelectedObjectsAsArray()).toEqual([box]);
    guard.dispose();
  });
});
