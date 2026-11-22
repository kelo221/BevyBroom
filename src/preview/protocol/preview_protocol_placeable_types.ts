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

/** Every parameter kind the game bridge reports for an entity I/O pin. */
export const PREVIEW_PLACEABLE_IO_PARAMETER_KINDS = ['none', 'string', 'number', 'integer', 'bool'] as const;

/** Parameter value kind accepted by an entity I/O input or emitted by an output. */
export type PreviewPlaceableIoParameterKind = (typeof PREVIEW_PLACEABLE_IO_PARAMETER_KINDS)[number];

/**
 * Metadata for one declared entity I/O input or output pin on a placeable
 * class.
 */
export interface PreviewPlaceableIoPin {
  name: string;
  description: string;
  parameter_kind?: PreviewPlaceableIoParameterKind;
}

/** One authored entity I/O output connection row on an object. */
export interface PreviewAuthoredLogicOutput {
  output: string;
  target: string;
  input: string;
  parameter: string;
  delay: number;
  times_to_fire: number;
}

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
  /** How the editor names and groups each variant of an enum field, by variant. */
  variant_details?: Record<string, PreviewPlaceableVariantDetail>;
  /**
   * Values the enum field used to hold, by old value: the value each means now.
   * The editor rewrites old values, so the game never sees them.
   */
  renamed_variants?: Record<string, string>;
  asset_type?: string;
  children?: PreviewPlaceableField[];
  hidden?: boolean;
}

/**
 * Display name and group of one enum variant, such as the label "Big fridge" in
 * the group "Fridges & freezers" for the variant `big-fridge`.
 */
export interface PreviewPlaceableVariantDetail {
  label?: string;
  group?: string;
  /** Light the editor adds as a child of an entity holding the variant. */
  light?: PreviewPlaceableVariantLight;
}

/**
 * Light an entity holding an enum variant carries, such as the tube of a
 * fluorescent fixture. Positions are meters in the entity's own space; the
 * color is linear, 0 to 1 per channel.
 */
export interface PreviewPlaceableVariantLight {
  kind: 'tube' | 'point';
  /** Tube only: one end. */
  from?: [number, number, number];
  /** Tube only: the other end. */
  to?: [number, number, number];
  /** Point only: where the light sits. */
  at?: [number, number, number];
  color: [number, number, number];
  intensity: number;
  /** Meters from the light where its light ends. */
  radius: number;
  /** DynLight effect kind in snake case, such as `fluorescent_starter`. */
  effect?: string;
  fog?: PreviewPlaceableVariantLightFog;
}

/**
 * Fog hanging from a variant's light down to the floor and `below_floor_m`
 * more.
 */
export interface PreviewPlaceableVariantLightFog {
  intensity: number;
  thickness: number;
  /** Meters within which objects inside the fog stay clearly visible. */
  visibility_m: number;
  /** How far below the floor the fog reaches, in meters. */
  below_floor_m: number;
}

/**
 * Box the editor draws as the marker of a game entity carrying a class, in
 * meters in the entity's own space: its edge lengths and where its center sits
 * relative to the entity's origin. A box may name a binary glTF model, a path
 * relative to the project's asset root, that the editor draws at the entity's
 * origin inside the box.
 */
export interface PreviewPlaceableMarkerBox {
  size: [number, number, number];
  offset: [number, number, number];
  model?: string;
}

/** Every way a game treats the collision of a brush entity, the default first. */
export const PREVIEW_PLACEABLE_COLLISION_KINDS = ['solid', 'volume', 'none'] as const;

/**
 * How a game treats the collision of brush entities of a class: `solid` blocks,
 * `volume` is an area the game reads where nothing collides and that is not
 * drawn, `none` is drawn only.
 */
export type PreviewPlaceableCollisionKind = (typeof PREVIEW_PLACEABLE_COLLISION_KINDS)[number];

/** One placeable component type of the game. */
export interface PreviewPlaceableClass {
  type_path: string;
  label: string;
  category: string;
  placement: PreviewPlaceablePlacement;
  marker_color: [number, number, number];
  /**
   * Name of the editor icon drawn on markers and listed in menus, such as
   * `lightbulb`. Unknown names show the default game entity icon.
   */
  icon?: string;
  /** Marker box of entities whose box is not picked by a field value. */
  marker_box?: PreviewPlaceableMarkerBox;
  /** Field path whose value, as text, picks the marker box from `marker_boxes`. */
  marker_box_field?: string;
  /** Marker boxes by the text value of `marker_box_field`. */
  marker_boxes?: Record<string, PreviewPlaceableMarkerBox>;
  /**
   * Collision kind brush entities carrying this class take unless they override
   * it.
   */
  collision?: PreviewPlaceableCollisionKind;
  /**
   * Type paths the class had before, as bare paths or with the values the old
   * class gave fields a component left out. The editor rewrites them.
   */
  renamed_from?: (string | PreviewPlaceableClassRename)[];
  /** Components of other classes the class takes over by an enum value. */
  absorbs?: PreviewPlaceableClassAbsorb[];
  fields: PreviewPlaceableField[];
  inputs?: PreviewPlaceableIoPin[];
  outputs?: PreviewPlaceableIoPin[];
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

/**
 * An old type path of a class with the values the old class gave fields a
 * component left out, so an old `{}` keeps the meaning it had.
 */
export interface PreviewPlaceableClassRename {
  type_path: string;
  defaults?: Record<string, PreviewFieldValue>;
}

/**
 * Components of the class `from` whose enum field `field` holds one of
 * `variants` move into the absorbing class with their values. `default` is the
 * value an old component without the field held.
 */
export interface PreviewPlaceableClassAbsorb {
  from: string;
  field: string;
  variants: string[];
  default?: string;
}
