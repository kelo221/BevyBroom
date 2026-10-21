import { GameEntityClassProvider } from '@/game_entity/class/game_entity_class_provider.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type {
  GameEntityClass,
  GameEntityClassList,
  GameEntityField,
} from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';

/** Type path of the door test class. */
export const TEST_DOOR_TYPE_PATH = 'test_game::doors::Door';

/** Type path of the spinner test class. */
export const TEST_SPINNER_TYPE_PATH = 'test_game::motion::Spinner';

/** Type path of the door stats test asset type. */
export const TEST_DOOR_STATS_TYPE_PATH = 'test_game::doors::DoorStats';

/**
 * Returns a door class with one field of every kind, the way a game reports it.
 *
 * @returns Door class.
 */
export function testDoorClassCreate(): GameEntityClass {
  return {
    type_path: TEST_DOOR_TYPE_PATH,
    label: 'Door',
    category: 'Doors',
    placement: 'point',
    marker_color: [0.9, 0.5, 0.1],
    fields: [
      { path: 'speed', label: 'Speed', kind: 'number', default: 1.5, minimum: 0, maximum: 10, step: 0.1 },
      { path: 'locked', label: 'locked', kind: 'bool', default: false },
      { path: 'key_name', label: 'key_name', kind: 'text', default: 'brass' },
      { path: 'uses', label: 'uses', kind: 'integer', default: 3, minimum: 0, maximum: 255, step: 1 },
      { path: 'kind', label: 'kind', kind: 'enum', default: 'Wooden', variants: ['Wooden', 'Iron', 'Glass'] },
      { path: 'open_offset', label: 'open_offset', kind: 'vector3', default: [0, 2.5, 0] },
      { path: 'tint', label: 'tint', kind: 'color', default: [1, 1, 1, 1] },
      {
        path: 'hinge',
        label: 'hinge',
        kind: 'group',
        default: null,
        children: [{ path: 'hinge.angle', label: 'angle', kind: 'number', default: 90 }],
      },
      { path: 'stats', label: 'stats', kind: 'asset', default: null, asset_type: TEST_DOOR_STATS_TYPE_PATH },
      { path: 'secret', label: 'secret', kind: 'integer', default: 7, hidden: true },
      { path: 'pending', label: 'pending', kind: 'unsupported', default: null },
    ],
  };
}

/**
 * Returns a spinner class that may be attached to any object.
 *
 * @returns Spinner class.
 */
export function testSpinnerClassCreate(): GameEntityClass {
  return {
    type_path: TEST_SPINNER_TYPE_PATH,
    label: 'Spinner',
    category: 'Motion',
    placement: 'any',
    marker_color: [0.3, 0.9, 0.5],
    fields: [
      { path: 'speed', label: 'speed', kind: 'number', default: 1 },
      { path: 'axis', label: 'axis', kind: 'vector3', default: [0, 1, 0] },
    ],
  };
}

/**
 * Returns a class list with the door and spinner classes and the door stats
 * asset type with two files.
 *
 * @returns Class list.
 */
export function testClassListCreate(): GameEntityClassList {
  return {
    generation: 4,
    asset_generation: 9,
    classes: [testDoorClassCreate(), testSpinnerClassCreate()],
    asset_types: [
      {
        type_path: TEST_DOOR_STATS_TYPE_PATH,
        label: 'DoorStats',
        extensions: ['door.ron'],
        editable: true,
        paths: ['data/heavy.door.ron', 'data/light.door.ron'],
        fields: [
          { path: 'health', label: 'health', kind: 'number', default: 100 },
          { path: 'open_seconds', label: 'open_seconds', kind: 'number', default: 1 },
        ],
      },
    ],
  };
}

/**
 * Registers a provider holding the test classes and returns a function that
 * removes it again.
 *
 * @param list Classes to provide; the test class list by default.
 * @returns Provider and its removal.
 */
export function testClassesInstall(list: GameEntityClassList = testClassListCreate()): {
  provider: GameEntityClassProvider;
  uninstall: () => void;
} {
  const provider = new GameEntityClassProvider('test');
  provider.listWrite(list);
  GameEntityClassRegistry.providerRegister(provider);
  return { provider, uninstall: () => GameEntityClassRegistry.providerUnregister(provider) };
}

/**
 * Returns the door test field at a path, searching groups too.
 *
 * @param path Field path.
 * @returns Field description.
 */
export function testDoorField(path: string): GameEntityField {
  const door = testDoorClassCreate();
  const field =
    door.fields.find((candidate) => candidate.path === path) ?? GameEntityComponentResolver.fieldFind(door, path);
  if (!field) {
    throw new Error(`the door has no field ${path}`);
  }
  return field;
}
