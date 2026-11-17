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
});
