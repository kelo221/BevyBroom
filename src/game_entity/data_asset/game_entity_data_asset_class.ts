import type { GameEntityAssetType, GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';

/** Grey used where a data asset needs a marker color. */
const GAME_ENTITY_DATA_ASSET_COLOR: [number, number, number] = [0.5, 0.5, 0.5];

/**
 * Describes a data asset type as a class so the component editors can show and
 * edit its fields.
 *
 * @param assetType Editable asset type reported by the game.
 * @returns Class with the asset type's fields and defaults.
 */
export function gameEntityDataAssetClassCreate(assetType: GameEntityAssetType): GameEntityClass {
  return {
    type_path: assetType.type_path,
    label: assetType.label,
    category: 'Data Assets',
    placement: 'any',
    marker_color: GAME_ENTITY_DATA_ASSET_COLOR,
    fields: assetType.fields ?? [],
  };
}

/**
 * Suggests the asset path of a new data asset file: next to the type's existing
 * files, named after the type and not taken yet.
 *
 * @param assetType Editable asset type.
 * @returns Asset path such as `data/doors/door_stats_2.door.ron`.
 */
export function gameEntityDataAssetPathSuggest(assetType: GameEntityAssetType): string {
  const firstPath = assetType.paths[0] ?? '';
  const directory = firstPath.includes('/') ? firstPath.slice(0, firstPath.lastIndexOf('/')) : 'data';
  const extension = assetType.extensions[0] ?? 'ron';
  const stem = assetType.label.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  const taken = new Set(assetType.paths);
  let candidate = `${directory}/${stem}.${extension}`;
  for (let counter = 2; taken.has(candidate); counter++) {
    candidate = `${directory}/${stem}_${counter}.${extension}`;
  }
  return candidate;
}

/**
 * Returns whether an asset path names a file of an asset type.
 *
 * @param assetType Asset type.
 * @param path Asset path.
 * @returns True when the path ends with one of the type's extensions.
 */
export function gameEntityDataAssetPathMatches(assetType: GameEntityAssetType, path: string): boolean {
  return assetType.extensions.some((extension) => path.endsWith(`.${extension}`) && path.length > extension.length + 1);
}
