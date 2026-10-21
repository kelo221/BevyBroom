import { describe, expect, it } from 'vitest';
import {
  gameEntityClassFromUnknown,
  gameEntityClassListFromUnknown,
  gameEntityClassShortName,
} from '@/game_entity/class/game_entity_class_schema.js';
import { testClassListCreate, testDoorClassCreate } from '../game_entity_test_classes.js';

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

  it('rejects values that are not objects', () => {
    expect(gameEntityClassListFromUnknown('classes')).toBeNull();
    expect(gameEntityClassListFromUnknown([testDoorClassCreate()])).toBeNull();
  });
});
