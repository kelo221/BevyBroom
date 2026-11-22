import {
  PREVIEW_PLACEABLE_COLLISION_KINDS,
  PREVIEW_PLACEABLE_FIELD_KINDS,
  PREVIEW_PLACEABLE_IO_PARAMETER_KINDS,
  type PreviewPlaceableAssetType,
  type PreviewPlaceableClass,
  type PreviewPlaceableClassList,
  type PreviewPlaceableField,
  type PreviewPlaceableFieldKind,
  type PreviewPlaceableIoParameterKind,
  type PreviewPlaceableIoPin,
  type PreviewPlaceableMarkerBox,
  type PreviewPlaceableVariantDetail,
} from '@/preview/protocol/preview_protocol_placeable_types.js';
import { gameEntityFieldValueFromUnknown } from '@/game_entity/component/game_entity_component_value.js';
import { gameEntityVariantLightFromUnknown } from '@/game_entity/class/game_entity_class_variant_light.js';
import {
  gameEntityClassMigrationRead,
  gameEntityFieldRenamedVariantsRead,
} from '@/game_entity/class/game_entity_class_migration_schema.js';

/** One placeable component type of the game, as the editor shows it. */
export type GameEntityClass = PreviewPlaceableClass;

/** One field of a game component class. */
export type GameEntityField = PreviewPlaceableField;

/** Box a game entity marker is drawn as, in the entity's own space. */
export type GameEntityMarkerBox = PreviewPlaceableMarkerBox;

/** Display name and group of one enum variant. */
export type GameEntityVariantDetail = PreviewPlaceableVariantDetail;

/** One asset type that asset fields may reference. */
export type GameEntityAssetType = PreviewPlaceableAssetType;

/** One declared entity I/O input or output of a game component class. */
export type GameEntityIoPin = PreviewPlaceableIoPin;

/** Every class and asset type one source knows. */
export type GameEntityClassList = PreviewPlaceableClassList;

/** Marker color of classes that do not name one. */
const GAME_ENTITY_CLASS_DEFAULT_COLOR: [number, number, number] = [0.35, 0.65, 0.95];

/**
 * Returns an empty class list.
 *
 * @returns Class list without classes or asset types.
 */
export function gameEntityClassListEmpty(): GameEntityClassList {
  return { generation: 0, asset_generation: 0, classes: [], asset_types: [] };
}

/**
 * Reads untrusted data (bridge replies, scene files, storage) into a class
 * list, dropping every entry that is malformed.
 *
 * @param value Any value.
 * @returns Valid class list, or null when the value is not an object.
 */
export function gameEntityClassListFromUnknown(value: unknown): GameEntityClassList | null {
  if (!gameEntityRecordIs(value)) {
    return null;
  }
  return {
    generation: gameEntityNumberRead(value['generation'], 0),
    asset_generation: gameEntityNumberRead(value['asset_generation'], 0),
    classes: gameEntityArrayRead(value['classes'], gameEntityClassFromUnknown),
    asset_types: gameEntityArrayRead(value['asset_types'], gameEntityAssetTypeFromUnknown),
  };
}

/**
 * Reads one untrusted class.
 *
 * @param value Any value.
 * @returns Valid class, or null when it has no type path.
 */
export function gameEntityClassFromUnknown(value: unknown): GameEntityClass | null {
  if (!gameEntityRecordIs(value) || !gameEntityTextIsFilled(value['type_path'])) {
    return null;
  }
  const typePath = value['type_path'];
  const gameClass: GameEntityClass = {
    type_path: typePath,
    label: gameEntityTextRead(value['label'], gameEntityClassShortName(typePath)),
    category: gameEntityTextRead(value['category'], 'Game'),
    placement: value['placement'] === 'point' ? 'point' : 'any',
    marker_color: gameEntityColorRead(value['marker_color']),
    fields: gameEntityArrayRead(value['fields'], gameEntityFieldFromUnknown),
  };
  gameEntityClassIconRead(value, gameClass);
  gameEntityClassMigrationRead(value, gameClass);
  gameEntityClassPinsRead(value, gameClass);
  gameEntityClassMarkerBoxesRead(value, gameClass);
  gameEntityClassCollisionRead(value, gameClass);
  return gameClass;
}

/**
 * Copies the icon name of an untrusted class when it is filled text.
 *
 * @param value Untrusted class record.
 * @param gameClass Class being built.
 */
function gameEntityClassIconRead(value: Record<string, unknown>, gameClass: GameEntityClass): void {
  if (gameEntityTextIsFilled(value['icon'])) {
    gameClass.icon = value['icon'];
  }
}

/**
 * Copies the collision kind of an untrusted class when it names a known kind.
 *
 * @param value Untrusted class record.
 * @param gameClass Class being built.
 */
function gameEntityClassCollisionRead(value: Record<string, unknown>, gameClass: GameEntityClass): void {
  const collision = value['collision'];
  const kind = PREVIEW_PLACEABLE_COLLISION_KINDS.find((candidate) => candidate === collision);
  if (kind !== undefined) {
    gameClass.collision = kind;
  }
}

/**
 * Copies the marker box declarations of an untrusted class, leaving out every
 * one that is missing or malformed.
 *
 * @param value Untrusted class record.
 * @param gameClass Class being built.
 */
function gameEntityClassMarkerBoxesRead(value: Record<string, unknown>, gameClass: GameEntityClass): void {
  const markerBox = gameEntityMarkerBoxFromUnknown(value['marker_box']);
  if (markerBox !== null) {
    gameClass.marker_box = markerBox;
  }
  if (gameEntityTextIsFilled(value['marker_box_field'])) {
    gameClass.marker_box_field = value['marker_box_field'];
  }
  const markerBoxes = gameEntityMarkerBoxMapRead(value['marker_boxes']);
  if (Object.keys(markerBoxes).length > 0) {
    gameClass.marker_boxes = markerBoxes;
  }
}

/**
 * Reads untrusted marker boxes keyed by field value.
 *
 * @param value Any value.
 * @returns Every valid box by its key; empty when the value is not an object.
 */
function gameEntityMarkerBoxMapRead(value: unknown): Record<string, GameEntityMarkerBox> {
  const markerBoxes: Record<string, GameEntityMarkerBox> = {};
  if (!gameEntityRecordIs(value)) {
    return markerBoxes;
  }
  for (const [key, entry] of Object.entries(value)) {
    const markerBox = gameEntityMarkerBoxFromUnknown(entry);
    if (markerBox !== null) {
      markerBoxes[key] = markerBox;
    }
  }
  return markerBoxes;
}

/**
 * Reads one untrusted marker box.
 *
 * @param value Any value.
 * @returns Valid box, or null when its size is missing or not positive. A
 *   missing or malformed offset reads as the origin; a model path that is not
 *   filled text is left out.
 */
export function gameEntityMarkerBoxFromUnknown(value: unknown): GameEntityMarkerBox | null {
  if (!gameEntityRecordIs(value)) {
    return null;
  }
  const size = gameEntityVector3Read(value['size']);
  if (size === null || size.some((edge) => edge <= 0)) {
    return null;
  }
  const markerBox: GameEntityMarkerBox = { size, offset: gameEntityVector3Read(value['offset']) ?? [0, 0, 0] };
  if (gameEntityTextIsFilled(value['model'])) {
    markerBox.model = value['model'];
  }
  return markerBox;
}

/**
 * Reads an untrusted list of three finite numbers.
 *
 * @param value Any value.
 * @returns The three numbers, or null when the value is not such a list.
 */
export function gameEntityVector3Read(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 3) {
    return null;
  }
  const [x, y, z] = value as unknown[];
  if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
    return null;
  }
  return [x, y, z].every(Number.isFinite) ? [x, y, z] : null;
}

/**
 * Copies the declared entity I/O inputs and outputs of an untrusted class,
 * leaving them out when the class declares none.
 *
 * @param value Untrusted class record.
 * @param gameClass Class being built.
 */
function gameEntityClassPinsRead(value: Record<string, unknown>, gameClass: GameEntityClass): void {
  const inputs = gameEntityArrayRead(value['inputs'], gameEntityIoPinFromUnknown);
  const outputs = gameEntityArrayRead(value['outputs'], gameEntityIoPinFromUnknown);
  if (inputs.length > 0) {
    gameClass.inputs = inputs;
  }
  if (outputs.length > 0) {
    gameClass.outputs = outputs;
  }
}

/**
 * Reads one untrusted entity I/O pin.
 *
 * @param value Any value.
 * @returns Valid pin, or null when it has no name.
 */
export function gameEntityIoPinFromUnknown(value: unknown): GameEntityIoPin | null {
  if (!gameEntityRecordIs(value) || !gameEntityTextIsFilled(value['name'])) {
    return null;
  }
  const pin: GameEntityIoPin = { name: value['name'], description: gameEntityTextRead(value['description'], '') };
  const kinds: readonly string[] = PREVIEW_PLACEABLE_IO_PARAMETER_KINDS;
  const kind = value['parameter_kind'];
  if (typeof kind === 'string' && kinds.includes(kind)) {
    pin.parameter_kind = kind as PreviewPlaceableIoParameterKind;
  }
  return pin;
}

/**
 * Reads one untrusted field, including the fields of a group.
 *
 * @param value Any value.
 * @returns Valid field, or null when it has no path.
 */
export function gameEntityFieldFromUnknown(value: unknown): GameEntityField | null {
  if (!gameEntityRecordIs(value) || !gameEntityTextIsFilled(value['path'])) {
    return null;
  }
  const field: GameEntityField = {
    path: value['path'],
    label: gameEntityTextRead(value['label'], value['path']),
    kind: gameEntityFieldKindRead(value['kind']),
    default: gameEntityFieldValueFromUnknown(value['default']) ?? null,
  };
  gameEntityFieldOptionalsRead(value, field);
  return field;
}

/**
 * Copies the optional parts of an untrusted field that are well formed.
 *
 * @param value Untrusted field record.
 * @param field Field being built.
 */
function gameEntityFieldOptionalsRead(value: Record<string, unknown>, field: GameEntityField): void {
  gameEntityFieldBoundsRead(value, field);
  if (Array.isArray(value['variants'])) {
    field.variants = value['variants'].filter((variant): variant is string => typeof variant === 'string');
  }
  gameEntityFieldVariantDetailsRead(value, field);
  gameEntityFieldRenamedVariantsRead(value, field);
  if (typeof value['asset_type'] === 'string') {
    field.asset_type = value['asset_type'];
  }
  if (Array.isArray(value['children'])) {
    field.children = gameEntityArrayRead(value['children'], gameEntityFieldFromUnknown);
  }
  if (value['hidden'] === true) {
    field.hidden = true;
  }
}

/**
 * Copies the well-formed variant names and groups of an untrusted enum field.
 *
 * @param value Untrusted field record.
 * @param field Field being built.
 */
function gameEntityFieldVariantDetailsRead(value: Record<string, unknown>, field: GameEntityField): void {
  const details = value['variant_details'];
  if (!gameEntityRecordIs(details)) {
    return;
  }
  const read: Record<string, GameEntityVariantDetail> = {};
  for (const [variant, entry] of Object.entries(details)) {
    const detail = gameEntityVariantDetailFromUnknown(entry);
    if (detail !== null) {
      read[variant] = detail;
    }
  }
  if (Object.keys(read).length > 0) {
    field.variant_details = read;
  }
}

/**
 * Reads the label, group and light of one enum variant.
 *
 * @param value Untrusted variant detail.
 * @returns Detail with its filled texts and valid light, or null when it has
 *   none.
 */
function gameEntityVariantDetailFromUnknown(value: unknown): GameEntityVariantDetail | null {
  if (!gameEntityRecordIs(value)) {
    return null;
  }
  const detail: GameEntityVariantDetail = {};
  if (gameEntityTextIsFilled(value['label'])) {
    detail.label = value['label'];
  }
  if (gameEntityTextIsFilled(value['group'])) {
    detail.group = value['group'];
  }
  const light = gameEntityVariantLightFromUnknown(value['light']);
  if (light !== null) {
    detail.light = light;
  }
  return Object.keys(detail).length > 0 ? detail : null;
}

/**
 * Copies the finite minimum, maximum and step of an untrusted field.
 *
 * @param value Untrusted field record.
 * @param field Field being built.
 */
function gameEntityFieldBoundsRead(value: Record<string, unknown>, field: GameEntityField): void {
  for (const key of ['minimum', 'maximum', 'step'] as const) {
    const bound = value[key];
    if (typeof bound === 'number' && Number.isFinite(bound)) {
      field[key] = bound;
    }
  }
}

/**
 * Reads one untrusted asset type.
 *
 * @param value Any value.
 * @returns Valid asset type, or null when it has no type path.
 */
function gameEntityAssetTypeFromUnknown(value: unknown): GameEntityAssetType | null {
  if (!gameEntityRecordIs(value) || !gameEntityTextIsFilled(value['type_path'])) {
    return null;
  }
  return {
    type_path: value['type_path'],
    label: gameEntityTextRead(value['label'], gameEntityClassShortName(value['type_path'])),
    extensions: gameEntityTextListRead(value['extensions']),
    editable: value['editable'] === true,
    paths: gameEntityTextListRead(value['paths']),
    fields: gameEntityArrayRead(value['fields'], gameEntityFieldFromUnknown),
  };
}

/**
 * Returns the last segment of a Rust type path.
 *
 * @param typePath Full type path such as `game::doors::Door`.
 * @returns Short name such as `Door`.
 */
export function gameEntityClassShortName(typePath: string): string {
  const segments = typePath.split('::');
  return segments[segments.length - 1] || typePath;
}

/**
 * Returns whether a value is a plain record.
 *
 * @param value Any value.
 * @returns True for non-array objects.
 */
export function gameEntityRecordIs(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Returns whether a value is a string with visible characters.
 *
 * @param value Any value.
 * @returns True for non-blank strings.
 */
export function gameEntityTextIsFilled(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Reads a string or falls back.
 *
 * @param value Any value.
 * @param fallback Text used when the value is not a string.
 * @returns Text.
 */
function gameEntityTextRead(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Reads a finite number or falls back.
 *
 * @param value Any value.
 * @param fallback Number used when the value is not finite.
 * @returns Number.
 */
function gameEntityNumberRead(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Reads a list of strings, dropping other entries.
 *
 * @param value Any value.
 * @returns Strings in order.
 */
function gameEntityTextListRead(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

/**
 * Reads every valid entry of an untrusted array.
 *
 * @param value Any value.
 * @param read Reads one entry, returning null for malformed ones.
 * @returns Valid entries in order.
 */
function gameEntityArrayRead<TEntry>(value: unknown, read: (entry: unknown) => TEntry | null): TEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(read).filter((entry): entry is TEntry => entry !== null);
}

/**
 * Reads a field kind, treating unknown kinds as unsupported.
 *
 * @param value Any value.
 * @returns Field kind.
 */
function gameEntityFieldKindRead(value: unknown): PreviewPlaceableFieldKind {
  const kinds: readonly string[] = PREVIEW_PLACEABLE_FIELD_KINDS;
  return typeof value === 'string' && kinds.includes(value) ? (value as PreviewPlaceableFieldKind) : 'unsupported';
}

/**
 * Reads an sRGB marker color with channels in zero to one.
 *
 * @param value Any value.
 * @returns Color channels.
 */
function gameEntityColorRead(value: unknown): [number, number, number] {
  if (!Array.isArray(value) || value.length < 3) {
    return [...GAME_ENTITY_CLASS_DEFAULT_COLOR];
  }
  const channel = (index: number): number => Math.min(1, Math.max(0, gameEntityNumberRead(value[index], 0)));
  return [channel(0), channel(1), channel(2)];
}
