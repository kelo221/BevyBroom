import type { SceneJSON } from '@/io/scene/io_types.js';
import { LAYER_DEFAULT_ID, type LayerDefinition, layerDefinitionCopy } from '@/layer/model/layer_definition.js';
import type { LayerManager } from '@/layer/model/layer_manager.js';

/**
 * Writes a layer manager's layers into scene files and reads them back,
 * tolerating files without layers and malformed layer entries.
 */
export class LayerDocumentCodec {
  /**
   * Stores every layer and the current layer in a scene file.
   *
   * @param manager Layer manager of the saved world.
   * @param scene Scene file being written.
   */
  static write(manager: LayerManager, scene: SceneJSON): void {
    scene.layers = manager.layersList().map(layerDefinitionCopy);
    scene.currentLayerId = manager.currentLayerIdRead();
  }

  /**
   * Replaces a manager's layers with those of a scene file. Files without
   * layers leave only the default layer.
   *
   * @param manager Layer manager of the world being loaded.
   * @param scene Scene file being read.
   */
  static read(manager: LayerManager, scene: SceneJSON): void {
    const rawLayers: unknown = scene.layers;
    const definitions = Array.isArray(rawLayers)
      ? rawLayers.map(LayerDocumentCodec.definitionFromUnknown).filter(LayerDocumentCodec.definitionIs)
      : [];
    const currentLayerIdentifier = typeof scene.currentLayerId === 'string' ? scene.currentLayerId : LAYER_DEFAULT_ID;
    manager.documentReplace(definitions, currentLayerIdentifier);
  }

  /**
   * Parses one layer entry of a scene file.
   *
   * @param value Raw entry.
   * @returns Layer definition, or null when the entry has no identifier.
   */
  static definitionFromUnknown(value: unknown): LayerDefinition | null {
    if (typeof value !== 'object' || value === null) {
      return null;
    }
    const record = value as Record<string, unknown>;
    const identifier = record['id'];
    if (typeof identifier !== 'string' || identifier.length === 0) {
      return null;
    }
    const name = record['name'];
    return {
      id: identifier,
      name: typeof name === 'string' && name.trim().length > 0 ? name : identifier,
      hidden: record['hidden'] === true,
      locked: record['locked'] === true,
      omitFromExport: record['omitFromExport'] === true,
    };
  }

  /**
   * Returns whether a parsed entry is a layer definition.
   *
   * @param definition Parsed entry.
   * @returns True when the entry is not null.
   */
  private static definitionIs(definition: LayerDefinition | null): definition is LayerDefinition {
    return definition !== null;
  }
}
