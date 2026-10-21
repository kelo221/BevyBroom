import {
  PREVIEW_PLACEABLE_FIELD_KINDS,
  type PreviewPlaceableAssetType,
  type PreviewPlaceableClass,
  type PreviewPlaceableClassList,
  type PreviewPlaceableField,
  type PreviewPlaceableFieldKind,
} from '@/preview/protocol/preview_protocol_placeable_types.js';
import { gameEntityFieldValueFromUnknown } from '@/game_entity/component/game_entity_component_value.js';

/** One placeable component type of the game, as the editor shows it. */
export type GameEntityClass = PreviewPlaceableClass;

/** One field of a game component class. */
export type GameEntityField = PreviewPlaceableField;

/** One asset type that asset fields may reference. */
export type GameEntityAssetType = PreviewPlaceableAssetType;

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
  return {
    type_path: typePath,
    label: gameEntityTextRead(value['label'], gameEntityClassShortName(typePath)),
    category: gameEntityTextRead(value['category'], 'Game'),
    placement: value['placement'] === 'point' ? 'point' : 'any',
    marker_color: gameEntityColorRead(value['marker_color']),
    fields: gameEntityArrayRead(value['fields'], gameEntityFieldFromUnknown),
  };
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
function gameEntityTextIsFilled(value: unknown): value is string {
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
