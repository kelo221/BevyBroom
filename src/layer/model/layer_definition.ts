/** Identifier of the fixed default layer every document has. */
export const LAYER_DEFAULT_ID = 'layer_default';

/** Display name of the fixed default layer. */
export const LAYER_DEFAULT_NAME = 'Default Layer';

/** Names of the switches a layer carries. */
export type LayerFlagName = 'hidden' | 'locked' | 'omitFromExport';

/** Every layer switch name, in the order the layers panel shows them. */
export const LAYER_FLAG_NAMES: readonly LayerFlagName[] = ['omitFromExport', 'hidden', 'locked'];

/** One layer of a document: a named set of top-level objects with switches. */
export interface LayerDefinition {
  /** Stable identifier stored on member objects. */
  id: string;
  /** Display name. */
  name: string;
  /** True when the layer's objects are not drawn or pickable in the editor. */
  hidden: boolean;
  /** True when the layer's objects cannot be selected or edited. */
  locked: boolean;
  /** True when the layer's objects are left out of exports and the game. */
  omitFromExport: boolean;
}

/**
 * Creates a layer with every switch off.
 *
 * @param id Layer identifier.
 * @param name Display name.
 * @returns New layer definition.
 */
export function layerDefinitionCreate(id: string, name: string): LayerDefinition {
  return { id, name, hidden: false, locked: false, omitFromExport: false };
}

/**
 * Creates the fixed default layer with every switch off.
 *
 * @returns New default layer definition.
 */
export function layerDefinitionDefaultCreate(): LayerDefinition {
  return layerDefinitionCreate(LAYER_DEFAULT_ID, LAYER_DEFAULT_NAME);
}

/**
 * Copies a layer definition so callers cannot change the original.
 *
 * @param definition Layer to copy.
 * @returns Independent copy.
 */
export function layerDefinitionCopy(definition: LayerDefinition): LayerDefinition {
  return { ...definition };
}

/**
 * Returns whether a value names a layer switch.
 *
 * @param value Candidate value.
 * @returns True for hidden, locked and omitFromExport.
 */
export function layerFlagNameIs(value: unknown): value is LayerFlagName {
  return typeof value === 'string' && (LAYER_FLAG_NAMES as readonly string[]).includes(value);
}
