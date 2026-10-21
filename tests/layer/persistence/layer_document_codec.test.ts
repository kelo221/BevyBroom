import { describe, expect, it } from 'vitest';
import { LayerDocumentCodec } from '@/layer/persistence/layer_document_codec.js';
import { LAYER_DEFAULT_ID } from '@/layer/model/layer_definition.js';
import type { SceneJSON } from '@/io/scene/io_types.js';
import { layerTestLayerAdd, layerTestWorldCreate } from '../layer_test_world.js';

/** Unit tests for writing layers into scene files and reading them back. */
describe('LayerDocumentCodec', () => {
  it('writes every layer and the current layer, and reads them back', () => {
    const source = layerTestWorldCreate();
    const layer = layerTestLayerAdd(source.manager, 'Written');
    source.manager.currentLayerSet(layer.id);
    const scene: SceneJSON = { version: 7, objects: [] };
    LayerDocumentCodec.write(source.manager, scene);
    const target = layerTestWorldCreate();
    LayerDocumentCodec.read(target.manager, scene);
    expect(target.manager.layersList()).toEqual(source.manager.layersList());
    expect(target.manager.currentLayerIdRead()).toBe(layer.id);
  });

  it('skips malformed entries and fills in missing fields', () => {
    const target = layerTestWorldCreate();
    const scene = {
      version: 7,
      objects: [],
      layers: [null, { name: 'No id' }, { id: 'kept_layer', hidden: 'yes', locked: true }],
    } as unknown as SceneJSON;
    LayerDocumentCodec.read(target.manager, scene);
    expect(target.manager.layersList().map((definition) => definition.id)).toEqual([LAYER_DEFAULT_ID, 'kept_layer']);
    expect(target.manager.layerFind('kept_layer')).toMatchObject({ hidden: false, locked: true, name: 'kept_layer' });
    expect(target.manager.currentLayerIdRead()).toBe(LAYER_DEFAULT_ID);
  });
});
