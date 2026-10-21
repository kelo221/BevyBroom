import { describe, expect, it } from 'vitest';
import { OutlinerItem } from '@/outliner/ui/outliner_item.js';
import { layerTestBoxAddToLayer, layerTestLayerAdd, layerTestWorldCreate } from '../../layer/layer_test_world.js';

/** Unit tests for how outliner rows show objects of hidden layers. */
describe('OutlinerItem with layers', () => {
  it('greys out rows of objects in hidden layers and restores them when shown', () => {
    const testWorld = layerTestWorldCreate();
    const layer = layerTestLayerAdd(testWorld.manager, 'Hidden');
    const box = layerTestBoxAddToLayer(testWorld, layer.id, 'box');
    const item = new OutlinerItem(box, 0, false);
    expect(item.getNameElement().style.opacity).toBe('');
    testWorld.manager.layerFlagSet(layer.id, 'hidden', true);
    item.rebindObject(box, 0, false);
    const greyedOpacity = Number(item.getNameElement().style.opacity);
    expect(greyedOpacity).toBeGreaterThan(0);
    expect(greyedOpacity).toBeLessThan(1);
    testWorld.manager.layerFlagSet(layer.id, 'hidden', false);
    item.rebindObject(box, 0, false);
    expect(item.getNameElement().style.opacity).toBe('');
  });
});
