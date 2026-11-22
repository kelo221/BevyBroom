import { gameEntityRecordIs, gameEntityTextIsFilled } from '@/game_entity/class/game_entity_class_schema.js';
import { gameEntityFieldValueFromUnknown } from '@/game_entity/component/game_entity_component_value.js';
import type {
  PreviewFieldValue,
  PreviewPlaceableClass,
  PreviewPlaceableClassAbsorb,
  PreviewPlaceableClassRename,
  PreviewPlaceableField,
} from '@/preview/protocol/preview_protocol_placeable_types.js';

/** An old type path of a class with what an old component left out meant. */
export type GameEntityClassRename = PreviewPlaceableClassRename;

/** Components of another class a class takes over by an enum value. */
export type GameEntityClassAbsorb = PreviewPlaceableClassAbsorb;

/**
 * Copies the well-formed old type paths and absorbed classes of an untrusted
 * class.
 *
 * @param value Untrusted class record.
 * @param gameClass Class being built.
 */
export function gameEntityClassMigrationRead(value: Record<string, unknown>, gameClass: PreviewPlaceableClass): void {
  const renames = gameEntityMigrationListRead(value['renamed_from'], gameEntityClassRenameFromUnknown);
  if (renames.length > 0) {
    gameClass.renamed_from = renames;
  }
  const absorbs = gameEntityMigrationListRead(value['absorbs'], gameEntityClassAbsorbFromUnknown);
  if (absorbs.length > 0) {
    gameClass.absorbs = absorbs;
  }
}

/**
 * Copies the well-formed old enum values of an untrusted field.
 *
 * @param value Untrusted field record.
 * @param field Field being built.
 */
export function gameEntityFieldRenamedVariantsRead(value: Record<string, unknown>, field: PreviewPlaceableField): void {
  const source = value['renamed_variants'];
  if (!gameEntityRecordIs(source)) {
    return;
  }
  const renames = Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, string] => gameEntityTextIsFilled(entry[1])),
  );
  if (Object.keys(renames).length > 0) {
    field.renamed_variants = renames;
  }
}

/**
 * Returns an old type path entry in its long form.
 *
 * @param rename Bare old type path or long form.
 * @returns Long form with the defaults it names, none for a bare path.
 */
export function gameEntityClassRenameNormalize(rename: string | GameEntityClassRename): GameEntityClassRename {
  return typeof rename === 'string' ? { type_path: rename } : rename;
}

/**
 * Reads one untrusted old type path.
 *
 * @param value Any value.
 * @returns The bare path, the long form with its valid defaults, or null.
 */
function gameEntityClassRenameFromUnknown(value: unknown): string | GameEntityClassRename | null {
  if (gameEntityTextIsFilled(value)) {
    return value;
  }
  if (!gameEntityRecordIs(value) || !gameEntityTextIsFilled(value['type_path'])) {
    return null;
  }
  const defaults = gameEntityMigrationDefaultsRead(value['defaults']);
  return Object.keys(defaults).length > 0
    ? { type_path: value['type_path'], defaults }
    : { type_path: value['type_path'] };
}

/**
 * Reads untrusted old defaults.
 *
 * @param value Any value.
 * @returns Every field value that is valid, by field path.
 */
function gameEntityMigrationDefaultsRead(value: unknown): Record<string, PreviewFieldValue> {
  if (!gameEntityRecordIs(value)) {
    return {};
  }
  const defaults: Record<string, PreviewFieldValue> = {};
  for (const [path, entry] of Object.entries(value)) {
    const fieldValue = gameEntityFieldValueFromUnknown(entry);
    if (fieldValue !== undefined) {
      defaults[path] = fieldValue;
    }
  }
  return defaults;
}

/**
 * Reads one untrusted absorbed class.
 *
 * @param value Any value.
 * @returns The absorbed class with its listed values, or null when its class,
 *   field or values are missing.
 */
function gameEntityClassAbsorbFromUnknown(value: unknown): GameEntityClassAbsorb | null {
  if (!gameEntityRecordIs(value)) {
    return null;
  }
  const { from, field, variants } = value;
  const listed = Array.isArray(variants) ? variants.filter(gameEntityTextIsFilled) : [];
  if (!gameEntityTextIsFilled(from) || !gameEntityTextIsFilled(field) || listed.length === 0) {
    return null;
  }
  const absorb: GameEntityClassAbsorb = { from, field, variants: listed };
  if (gameEntityTextIsFilled(value['default'])) {
    absorb.default = value['default'];
  }
  return absorb;
}

/**
 * Reads an untrusted list, dropping malformed entries.
 *
 * @param value Any value.
 * @param read Reads one entry, null for malformed ones.
 * @returns Valid entries in order.
 */
function gameEntityMigrationListRead<TEntry>(value: unknown, read: (entry: unknown) => TEntry | null): TEntry[] {
  return Array.isArray(value) ? value.map(read).filter((entry): entry is TEntry => entry !== null) : [];
}
