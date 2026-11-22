import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gameEntityClassRenameNormalize } from '@/game_entity/class/game_entity_class_migration_schema.js';
import {
  gameEntityClassFromUnknown,
  gameEntityClassListFromUnknown,
} from '@/game_entity/class/game_entity_class_schema.js';

/** Directory of the wire fixtures both sides parse. */
const FIXTURE_BRIDGE_DIRECTORY = resolve(process.cwd(), 'bevy/fixtures');

/**
 * Class files may record renames: old type paths, absorbed classes and old enum
 * values.
 */
describe('game entity class migration rules', () => {
  it('reads bare and long old type paths, absorbed classes and old enum values, dropping malformed ones', () => {
    const gameClass = gameEntityClassFromUnknown({
      type_path: 'store::StockFixture',
      renamed_from: [
        'store::Shelf',
        { type_path: 'store::Rack', defaults: { fixture: 'rack-2' } },
        7,
        { defaults: {} },
      ],
      absorbs: [
        { from: 'store::StoreProp', field: 'fixture', variants: ['freezer', 3], default: 'freezer' },
        { from: 'store::StoreProp', field: 'fixture', variants: [] },
      ],
      fields: [
        {
          path: 'fixture',
          kind: 'enum',
          variants: ['shop-shelf-4'],
          renamed_variants: { 'shop-shelf': 'shop-shelf-4', bad: 1 },
        },
      ],
    });
    expect(gameClass?.renamed_from?.map(gameEntityClassRenameNormalize)).toEqual([
      { type_path: 'store::Shelf' },
      { type_path: 'store::Rack', defaults: { fixture: 'rack-2' } },
    ]);
    expect(gameClass?.absorbs).toEqual([
      { from: 'store::StoreProp', field: 'fixture', variants: ['freezer'], default: 'freezer' },
    ]);
    expect(gameClass?.fields[0]?.renamed_variants).toEqual({ 'shop-shelf': 'shop-shelf-4' });
  });

  it('leaves the keys out of classes that record no renames', () => {
    const gameClass = gameEntityClassFromUnknown({ type_path: 'store::Gate', renamed_from: [], absorbs: 'none' });
    expect(gameClass === null ? [] : Object.keys(gameClass)).not.toEqual(
      expect.arrayContaining(['renamed_from', 'absorbs']),
    );
  });

  it('keeps the migration rules of the shared bridge fixture', () => {
    const raw = JSON.parse(
      readFileSync(resolve(FIXTURE_BRIDGE_DIRECTORY, 'placeable_classes_sample.json'), 'utf8'),
    ) as {
      classes: Array<Record<string, unknown>>;
    };
    const rawDoor = raw.classes.find((entry) => entry['renamed_from'] !== undefined);
    const door = gameEntityClassListFromUnknown(raw)?.classes.find(
      (entry) => entry.type_path === rawDoor?.['type_path'],
    );
    expect(door?.renamed_from).toEqual(rawDoor?.['renamed_from']);
    expect(door?.absorbs).toEqual(rawDoor?.['absorbs']);
    expect(door?.fields.some((field) => field.renamed_variants !== undefined)).toBe(true);
  });
});
