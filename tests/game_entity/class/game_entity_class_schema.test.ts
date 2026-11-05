import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  gameEntityClassFromUnknown,
  gameEntityClassListFromUnknown,
  gameEntityClassShortName,
  gameEntityIoPinFromUnknown,
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

  it('rejects values that are not objects', () => {
    expect(gameEntityClassListFromUnknown('classes')).toBeNull();
    expect(gameEntityClassListFromUnknown([testDoorClassCreate()])).toBeNull();
  });
});
