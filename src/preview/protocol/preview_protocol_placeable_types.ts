/**
 * Wire types of placeable game components: the per-object component overrides
 * the editor sends and the class list the game reports. Field names are
 * snake_case because the game bridge reads them with serde.
 */

/** A normalized field value as it travels on the wire. */
export type PreviewFieldValue =
  number | boolean | string | null | number[] | { [key: string]: string | number | boolean };

/** Overrides of one component: field path to normalized value. */
export type PreviewComponentFields = Record<string, PreviewFieldValue>;

/** Component overrides of one object: component type path to its overrides. */
export type PreviewAuthoredComponents = Record<string, PreviewComponentFields>;

/** Every field kind the game bridge reports. */
export const PREVIEW_PLACEABLE_FIELD_KINDS = [
  'number',
  'integer',
  'bool',
  'text',
  'vector2',
  'vector3',
  'vector4',
  'color',
  'enum',
  'asset',
  'property_map',
  'group',
  'unsupported',
] as const;

/** How the editor shows and edits one field. */
export type PreviewPlaceableFieldKind = (typeof PREVIEW_PLACEABLE_FIELD_KINDS)[number];

/** Where a placeable component may be attached. */
export type PreviewPlaceablePlacement = 'point' | 'any';

/** One field of a placeable component. */
export interface PreviewPlaceableField {
  path: string;
  label: string;
  kind: PreviewPlaceableFieldKind;
  default: PreviewFieldValue;
  minimum?: number;
  maximum?: number;
  step?: number;
  variants?: string[];
  asset_type?: string;
  children?: PreviewPlaceableField[];
  hidden?: boolean;
}

/** One placeable component type of the game. */
export interface PreviewPlaceableClass {
  type_path: string;
  label: string;
  category: string;
  placement: PreviewPlaceablePlacement;
  marker_color: [number, number, number];
  fields: PreviewPlaceableField[];
}

/** One asset type that asset fields may reference. */
export interface PreviewPlaceableAssetType {
  type_path: string;
  label: string;
  extensions: string[];
  editable: boolean;
  paths: string[];
  /** Fields of editable data asset types, with the type's defaults. */
  fields?: PreviewPlaceableField[];
}

/** Reply to a placeable class request. */
export interface PreviewPlaceableClassList {
  generation: number;
  asset_generation: number;
  classes: PreviewPlaceableClass[];
  asset_types: PreviewPlaceableAssetType[];
}
