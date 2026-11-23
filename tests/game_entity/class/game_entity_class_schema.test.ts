import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  gameEntityClassFromUnknown,
  gameEntityClassListFromUnknown,
  gameEntityClassShortName,
  gameEntityIoPinFromUnknown,
  gameEntityMarkerBoxFromUnknown,
} from '@/game_entity/class/game_entity_class_schema.js';
import { testClassListCreate, testDoorClassCreate } from '../game_entity_test_classes.js';
import { testShelfRunClassJson } from '../game_entity_test_class_enum_list.js';

/** Wire fixtures of the game bridge workspace, parsed by its Rust tests too. */
const FIXTURE_BRIDGE_DIRECTORY = resolve(__dirname, '../../../bevy/fixtures');

/**
 * Class lists from the game, scene files and storage are read defensively: well
 * formed data survives unchanged and malformed entries are dropped.
 */
describe('game entity class schema', () => {
  it('keeps a well formed class list unchanged', () => {
    const list = testClassListCreate();
    expect(gameEntityClassListFromUnknown(JSON.parse(JSON.stringify(list)))).toEqual(list);
  });

  it('drops classes and fields without a path and reads unknown kinds as unsupported', () => {
    const door = testDoorClassCreate();
    const raw = {
      classes: [
        { label: 'no type path' },
        {
          ...door,
          fields: [
            { label: 'no path', kind: 'number' },
            { path: 'odd', kind: 'quaternion', default: 1 },
          ],
        },
      ],
    };
    const list = gameEntityClassListFromUnknown(raw);
    expect(list?.classes).toHaveLength(1);
    expect(list?.classes[0]?.fields).toEqual([{ path: 'odd', label: 'odd', kind: 'unsupported', default: 1 }]);
    expect(list?.asset_types).toEqual([]);
  });

  it('fills a missing label from the type path and clamps marker colors', () => {
    const gameClass = gameEntityClassFromUnknown({ type_path: 'game::things::Crate', marker_color: [2, -1, 0.5] });
    expect(gameClass?.label).toBe(gameEntityClassShortName('game::things::Crate'));
    expect(gameClass?.marker_color).toEqual([1, 0, 0.5]);
    expect(gameClass?.placement).toBe('any');
  });

  it('reads the names and groups of enum variants and drops malformed ones', () => {
    const gameClass = gameEntityClassFromUnknown({
      type_path: 'game::store::Prop',
      fields: [
        {
          path: 'fixture',
          kind: 'enum',
          default: 'freezer',
          variants: ['freezer', 'gate'],
          variant_details: { freezer: { label: 'Freezer', group: 'Cold' }, gate: { label: 3 }, ghost: 'x' },
        },
      ],
    });
    expect(gameClass?.fields[0]?.variant_details).toEqual({ freezer: { label: 'Freezer', group: 'Cold' } });
  });

  it('keeps the variant details of the shared bridge fixture', () => {
    const raw = JSON.parse(
      readFileSync(resolve(FIXTURE_BRIDGE_DIRECTORY, 'placeable_classes_sample.json'), 'utf8'),
    ) as { classes: Array<{ fields?: Array<Record<string, unknown>> }> };
    const rawDetails = raw.classes.flatMap((entry) => entry.fields ?? []).find((field) => field['variant_details']);
    const parsed = gameEntityClassListFromUnknown(raw)
      ?.classes.flatMap((entry) => entry.fields)
      .find((field) => field.variant_details !== undefined);
    expect(rawDetails).toBeDefined();
    expect(parsed?.variant_details).toEqual(rawDetails?.['variant_details']);
  });

  it('keeps the entity I/O pins of every class in the shared bridge fixture', () => {
    const raw = JSON.parse(
      readFileSync(resolve(FIXTURE_BRIDGE_DIRECTORY, 'placeable_classes_sample.json'), 'utf8'),
    ) as {
      classes: Array<Record<string, unknown>>;
    };
    const list = gameEntityClassListFromUnknown(raw);
    const rawWithPins = raw.classes.filter(
      (entry) => Array.isArray(entry['inputs']) || Array.isArray(entry['outputs']),
    );
    expect(rawWithPins.length).toBeGreaterThan(0);
    rawWithPins.forEach((rawClass) => {
      const parsed = list?.classes.find((entry) => entry.type_path === rawClass['type_path']);
      expect(parsed?.inputs ?? []).toEqual(rawClass['inputs'] ?? []);
      expect(parsed?.outputs ?? []).toEqual(rawClass['outputs'] ?? []);
    });
  });

  it('drops nameless pins, defaults descriptions and ignores unknown parameter kinds', () => {
    const gameClass = gameEntityClassFromUnknown({
      type_path: 'game::logic::Relay',
      inputs: [{ description: 'nameless' }, { name: 'Trigger', parameter_kind: 'integer' }],
      outputs: [{ name: 'OnTrigger', description: 'fires', parameter_kind: 'quaternion' }],
    });
    expect(gameClass?.inputs).toEqual([{ name: 'Trigger', description: '', parameter_kind: 'integer' }]);
    expect(gameClass?.outputs).toEqual([{ name: 'OnTrigger', description: 'fires' }]);
    expect(gameEntityIoPinFromUnknown('Trigger')).toBeNull();
  });

  it('leaves pins out of classes that declare none', () => {
    const gameClass = gameEntityClassFromUnknown({ type_path: 'game::things::Crate', inputs: [] });
    expect(gameClass && 'inputs' in gameClass).toBe(false);
    expect(gameClass && 'outputs' in gameClass).toBe(false);
  });

  it('keeps the marker boxes of a class and drops the malformed ones', () => {
    const plainBox = { size: [1, 2, 0.5], offset: [0, 1, 0] };
    const gameClass = gameEntityClassFromUnknown({
      type_path: 'game::store::Shelf',
      marker_box: plainBox,
      marker_box_field: 'fixture',
      marker_boxes: { tall: { size: [4, 2, 1] }, flat: { size: [4, 0, 1] }, odd: 'box' },
    });
    expect(gameClass?.marker_box).toEqual(plainBox);
    expect(gameClass?.marker_box_field).toBe('fixture');
    expect(gameClass?.marker_boxes).toEqual({ tall: { size: [4, 2, 1], offset: [0, 0, 0] } });
  });

  it('keeps the model a marker box names and leaves out blank or malformed ones', () => {
    const size = [1, 1, 1];
    expect(gameEntityMarkerBoxFromUnknown({ size, model: 'Models/Crate.glb' })?.model).toBe('Models/Crate.glb');
    [' ', 7, null].forEach((model) => {
      const markerBox = gameEntityMarkerBoxFromUnknown({ size, model });
      expect(markerBox === null ? [] : Object.keys(markerBox)).not.toContain('model');
    });
  });

  it('keeps the icon a class names and leaves out blank or malformed ones', () => {
    expect(gameEntityClassFromUnknown({ type_path: 'game::store::Lamp', icon: 'lightbulb' })?.icon).toBe('lightbulb');
    [' ', 7, null, undefined].forEach((icon) => {
      const gameClass = gameEntityClassFromUnknown({ type_path: 'game::store::Lamp', icon });
      expect(gameClass === null ? [] : Object.keys(gameClass)).not.toContain('icon');
    });
  });

  it('keeps the icon of every class in the shared bridge fixture', () => {
    const raw = JSON.parse(
      readFileSync(resolve(FIXTURE_BRIDGE_DIRECTORY, 'placeable_classes_sample.json'), 'utf8'),
    ) as { classes: Array<Record<string, unknown>> };
    const list = gameEntityClassListFromUnknown(raw);
    const rawWithIcons = raw.classes.filter((entry) => entry['icon'] !== undefined);
    expect(rawWithIcons.length).toBeGreaterThan(0);
    rawWithIcons.forEach((rawClass) => {
      expect(list?.classes.find((entry) => entry.type_path === rawClass['type_path'])?.icon).toBe(rawClass['icon']);
    });
  });

  it('keeps the marker dimming flag on bool fields only', () => {
    const gameClass = gameEntityClassFromUnknown({
      type_path: 'game::store::Shelf',
      fields: [
        { path: 'stocked', kind: 'bool', default: true, marker_dimmed_when_false: true },
        { path: 'count', kind: 'integer', default: 1, marker_dimmed_when_false: true },
        { path: 'lit', kind: 'bool', default: true, marker_dimmed_when_false: 'yes' },
      ],
    });
    const flags = gameClass?.fields.map((field) => field.marker_dimmed_when_false === true);
    expect(flags).toEqual([true, false, false]);
  });

  it('keeps the marker dimming flag of every field in the shared bridge fixture', () => {
    const raw = JSON.parse(
      readFileSync(resolve(FIXTURE_BRIDGE_DIRECTORY, 'placeable_classes_sample.json'), 'utf8'),
    ) as { classes: Array<{ type_path: string; fields: Array<Record<string, unknown>> }> };
    const list = gameEntityClassListFromUnknown(raw);
    const flagged = raw.classes.flatMap((rawClass) =>
      rawClass.fields
        .filter((field) => field['marker_dimmed_when_false'] === true)
        .map((field) => [rawClass, field] as const),
    );
    expect(flagged.length).toBeGreaterThan(0);
    flagged.forEach(([rawClass, rawField]) => {
      const gameClass = list?.classes.find((entry) => entry.type_path === rawClass.type_path);
      const field = gameClass?.fields.find((entry) => entry.path === rawField['path']);
      expect(field?.marker_dimmed_when_false).toBe(true);
    });
  });

  it('leaves marker box keys out of classes that declare none', () => {
    const gameClass = gameEntityClassFromUnknown({ type_path: 'game::store::Start', marker_boxes: {} });
    expect(gameClass === null ? [] : Object.keys(gameClass)).not.toEqual(
      expect.arrayContaining(['marker_box', 'marker_box_field', 'marker_boxes']),
    );
  });

  it('refuses marker boxes without a positive finite size', () => {
    expect(gameEntityMarkerBoxFromUnknown({ size: [1, -1, 1] })).toBeNull();
    expect(gameEntityMarkerBoxFromUnknown({ size: [1, 1] })).toBeNull();
    expect(gameEntityMarkerBoxFromUnknown({ size: [1, Number.NaN, 1] })).toBeNull();
    expect(gameEntityMarkerBoxFromUnknown({ size: [1, 1, 1], offset: ['x', 0, 0] })).toEqual({
      size: [1, 1, 1],
      offset: [0, 0, 0],
    });
  });

  it('keeps the marker boxes of every class in the shared bridge fixture', () => {
    const raw = JSON.parse(
      readFileSync(resolve(FIXTURE_BRIDGE_DIRECTORY, 'placeable_classes_sample.json'), 'utf8'),
    ) as { classes: Array<Record<string, unknown>> };
    const list = gameEntityClassListFromUnknown(raw);
    const rawWithBoxes = raw.classes.filter((entry) => entry['marker_box'] !== undefined);
    expect(rawWithBoxes.length).toBeGreaterThan(0);
    rawWithBoxes.forEach((rawClass) => {
      const parsed = list?.classes.find((entry) => entry.type_path === rawClass['type_path']);
      expect(parsed?.marker_box).toEqual(rawClass['marker_box']);
      expect(parsed?.marker_box_field).toEqual(rawClass['marker_box_field']);
      expect(parsed?.marker_boxes).toEqual(rawClass['marker_boxes']);
    });
  });

  it('rejects values that are not objects', () => {
    expect(gameEntityClassListFromUnknown('classes')).toBeNull();
    expect(gameEntityClassListFromUnknown([testDoorClassCreate()])).toBeNull();
  });

  it('reads the collision kind a class declares and drops unknown kinds', () => {
    const base = { type_path: 'game::Zone', fields: [] };
    expect(gameEntityClassFromUnknown({ ...base, collision: 'volume' })?.collision).toBe('volume');
    expect(gameEntityClassFromUnknown({ ...base, collision: 'lava' })?.collision).toBeUndefined();
    expect(gameEntityClassFromUnknown(base)).not.toHaveProperty('collision');
  });
});

/**
 * Class files may declare enum list fields: the kind, its ordered default and
 * its variant names, groups and renames all read.
 */
describe('gameEntityClassFromUnknown enum list fields', () => {
  it('reads the kind, the default list, the variant details and the renames', () => {
    const raw = testShelfRunClassJson();
    const rawField = (raw['fields'] as Array<Record<string, unknown>>)[0] ?? {};
    const field = gameEntityClassFromUnknown(raw)?.fields[0];
    expect(field?.kind).toBe('enum_list');
    expect(field?.default).toEqual(rawField['default']);
    expect(field?.variants).toEqual(rawField['variants']);
    expect(field?.variant_details).toEqual(rawField['variant_details']);
    expect(field?.renamed_variants).toEqual(rawField['renamed_variants']);
  });

  it('reads every enum list field of the shared bridge fixture as the bridge declares it', () => {
    const raw = JSON.parse(
      readFileSync(resolve(FIXTURE_BRIDGE_DIRECTORY, 'placeable_classes_sample.json'), 'utf8'),
    ) as { classes: Array<{ fields?: Array<Record<string, unknown>> }> };
    const rawFields = raw.classes
      .flatMap((entry) => entry.fields ?? [])
      .filter((field) => field['kind'] === 'enum_list');
    const parsed = gameEntityClassListFromUnknown(raw)?.classes.flatMap((entry) => entry.fields) ?? [];
    expect(rawFields.length).toBeGreaterThan(0);
    rawFields.forEach((rawField) => {
      const field = parsed.find((candidate) => candidate.kind === 'enum_list' && candidate.path === rawField['path']);
      expect(field?.default).toEqual(rawField['default']);
      expect(field?.variants).toEqual(rawField['variants']);
      expect(field?.renamed_variants).toEqual(rawField['renamed_variants']);
    });
  });

  it('reads a default that is no list of text as the empty list and drops repeats', () => {
    const fieldWith = (defaultValue: unknown): unknown =>
      gameEntityClassFromUnknown({
        type_path: 'test_game::Run',
        fields: [{ path: 'list', kind: 'enum_list', default: defaultValue, variants: ['a', 'b'] }],
      })?.fields[0]?.default;
    expect(fieldWith('a')).toEqual([]);
    expect(fieldWith([1, 2])).toEqual([]);
    expect(fieldWith(undefined)).toEqual([]);
    expect(fieldWith(['b', 'a', 'b'])).toEqual(['b', 'a']);
  });
});
