import * as THREE from 'three';
import {
  LAYER_DEFAULT_ID,
  type LayerDefinition,
  type LayerFlagName,
  layerDefinitionCopy,
  layerDefinitionCreate,
  layerDefinitionDefaultCreate,
} from '@/layer/model/layer_definition.js';

/** Prefix of the names given to new layers. */
const LAYER_NAME_PREFIX = 'Layer ';

/** Prefix of the identifiers given to new layers. */
const LAYER_IDENTIFIER_PREFIX = 'layer_';

/**
 * Ordered list of a document's layers. The default layer always exists, always
 * comes first and keeps its name.
 */
export class LayerList {
  private definitions: LayerDefinition[];

  /** Creates a list holding only the default layer. */
  constructor() {
    this.definitions = [layerDefinitionDefaultCreate()];
  }

  /**
   * Returns the layers in display order.
   *
   * @returns Live layer definitions; callers must not change them.
   */
  listRead(): readonly LayerDefinition[] {
    return this.definitions;
  }

  /**
   * Returns the default layer.
   *
   * @returns Default layer definition.
   */
  defaultRead(): LayerDefinition {
    const defaultLayer = this.definitions[0];
    if (defaultLayer === undefined) {
      throw new Error('The layer list lost its default layer');
    }
    return defaultLayer;
  }

  /**
   * Finds a layer by identifier.
   *
   * @param layerIdentifier Layer identifier.
   * @returns The layer, or null when no layer has the identifier.
   */
  find(layerIdentifier: string): LayerDefinition | null {
    return this.definitions.find((definition) => definition.id === layerIdentifier) ?? null;
  }

  /**
   * Returns the display index of a layer.
   *
   * @param layerIdentifier Layer identifier.
   * @returns Index, or -1 when no layer has the identifier.
   */
  indexOf(layerIdentifier: string): number {
    return this.definitions.findIndex((definition) => definition.id === layerIdentifier);
  }

  /**
   * Replaces every layer. A default layer is kept first even when missing from
   * the given layers; duplicate identifiers keep their first occurrence.
   *
   * @param definitions Layers in display order.
   */
  replace(definitions: readonly LayerDefinition[]): void {
    const givenDefault = definitions.find((definition) => definition.id === LAYER_DEFAULT_ID);
    const defaultLayer = givenDefault ? layerDefinitionCopy(givenDefault) : layerDefinitionDefaultCreate();
    defaultLayer.name = layerDefinitionDefaultCreate().name;
    this.definitions = [defaultLayer];
    definitions.forEach((definition) => {
      if (this.find(definition.id) === null) {
        this.definitions.push(layerDefinitionCopy(definition));
      }
    });
  }

  /**
   * Inserts a layer at a display index after the default layer.
   *
   * @param definition Layer to insert; its identifier must be unused.
   * @param index Desired index, clamped to the positions after the default.
   * @returns True when inserted.
   */
  insert(definition: LayerDefinition, index: number): boolean {
    if (this.find(definition.id) !== null) {
      return false;
    }
    this.definitions.splice(this.insertionIndexClamp(index), 0, layerDefinitionCopy(definition));
    return true;
  }

  /**
   * Removes a layer other than the default.
   *
   * @param layerIdentifier Layer identifier.
   * @returns Index the layer had, or -1 when nothing was removed.
   */
  delete(layerIdentifier: string): number {
    const index = this.indexOf(layerIdentifier);
    if (index <= 0) {
      return -1;
    }
    this.definitions.splice(index, 1);
    return index;
  }

  /**
   * Moves a layer other than the default to another index after the default.
   *
   * @param layerIdentifier Layer identifier.
   * @param index Desired index, clamped to the positions after the default.
   * @returns True when the layer moved.
   */
  move(layerIdentifier: string, index: number): boolean {
    const currentIndex = this.indexOf(layerIdentifier);
    const definition = this.definitions[currentIndex];
    if (currentIndex <= 0 || definition === undefined) {
      return false;
    }
    this.definitions.splice(currentIndex, 1);
    const targetIndex = this.insertionIndexClamp(index);
    this.definitions.splice(targetIndex, 0, definition);
    return targetIndex !== currentIndex;
  }

  /**
   * Renames a layer other than the default.
   *
   * @param layerIdentifier Layer identifier.
   * @param name New name; blank names are refused.
   * @returns True when renamed.
   */
  rename(layerIdentifier: string, name: string): boolean {
    const definition = this.find(layerIdentifier);
    const trimmedName = name.trim();
    if (definition === null || layerIdentifier === LAYER_DEFAULT_ID || trimmedName.length === 0) {
      return false;
    }
    definition.name = trimmedName;
    return true;
  }

  /**
   * Sets one switch of a layer.
   *
   * @param layerIdentifier Layer identifier.
   * @param flag Switch to set.
   * @param value New value.
   * @returns True when the layer exists and the value changed.
   */
  flagSet(layerIdentifier: string, flag: LayerFlagName, value: boolean): boolean {
    const definition = this.find(layerIdentifier);
    if (definition === null || definition[flag] === value) {
      return false;
    }
    definition[flag] = value;
    return true;
  }

  /**
   * Returns whether any layer has a switch on.
   *
   * @param flag Switch to test.
   * @returns True when at least one layer has the switch on.
   */
  flagAnyIs(flag: LayerFlagName): boolean {
    return this.definitions.some((definition) => definition[flag]);
  }

  /**
   * Creates a new layer named "Layer N" with an unused identifier, without
   * adding it.
   *
   * @returns New layer definition.
   */
  definitionAllocate(): LayerDefinition {
    const number = this.unusedNumberFind();
    return layerDefinitionCreate(this.identifierAllocate(), `${LAYER_NAME_PREFIX}${number}`);
  }

  /**
   * Returns the smallest layer number not used by a "Layer N" name.
   *
   * @returns Unused number starting at 1.
   */
  private unusedNumberFind(): number {
    const usedNames = new Set(this.definitions.map((definition) => definition.name));
    let number = 1;
    while (usedNames.has(`${LAYER_NAME_PREFIX}${number}`)) {
      number++;
    }
    return number;
  }

  /**
   * Returns an identifier no layer uses.
   *
   * @returns Unused identifier.
   */
  private identifierAllocate(): string {
    let identifier = `${LAYER_IDENTIFIER_PREFIX}${THREE.MathUtils.generateUUID()}`;
    while (this.find(identifier) !== null) {
      identifier = `${LAYER_IDENTIFIER_PREFIX}${THREE.MathUtils.generateUUID()}`;
    }
    return identifier;
  }

  /**
   * Clamps an index to the positions after the default layer.
   *
   * @param index Desired index.
   * @returns Clamped insertion index.
   */
  private insertionIndexClamp(index: number): number {
    return Math.max(1, Math.min(Math.round(index), this.definitions.length));
  }
}
