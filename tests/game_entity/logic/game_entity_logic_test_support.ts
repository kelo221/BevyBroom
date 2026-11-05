import * as THREE from 'three';
import type { GameEntityClass, GameEntityIoPin } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import type { AuthoredLogicOutput } from '@/game_entity/logic/game_entity_logic_types.js';
import {
  testClassListCreate,
  testClassesInstall,
  testDoorClassCreate,
  TEST_DOOR_TYPE_PATH,
} from '../game_entity_test_classes.js';

/** Type path of the button test class that fires outputs. */
export const TEST_BUTTON_TYPE_PATH = 'test_game::logic::Button';

/** Inputs the door test class declares for the entity I/O tests. */
export const TEST_DOOR_INPUT_PINS: readonly GameEntityIoPin[] = [
  { name: 'Open', description: 'Opens the door' },
  { name: 'Close', description: 'Closes the door' },
];

/** Outputs the button test class declares for the entity I/O tests. */
export const TEST_BUTTON_OUTPUT_PINS: readonly GameEntityIoPin[] = [
  { name: 'OnPressed', description: 'Fired when the button is pressed' },
  { name: 'OnReleased', description: 'Fired when the button is released' },
];

/** Scene the entity I/O tests work in. */
export interface LogicTestScene {
  readonly button: THREE.Group;
  readonly doors: readonly THREE.Group[];
}

/**
 * Installs the door class with inputs and a button class with outputs.
 *
 * @returns Function that removes the classes again.
 */
export function logicTestClassesInstall(): () => void {
  const door: GameEntityClass = { ...testDoorClassCreate(), inputs: [...TEST_DOOR_INPUT_PINS] };
  const button: GameEntityClass = {
    type_path: TEST_BUTTON_TYPE_PATH,
    label: 'Button',
    category: 'Logic',
    placement: 'point',
    marker_color: [0.2, 0.8, 0.9],
    fields: [],
    outputs: [...TEST_BUTTON_OUTPUT_PINS],
  };
  return testClassesInstall({ ...testClassListCreate(), classes: [door, button] }).uninstall;
}

/**
 * Creates a named object carrying one game component class.
 *
 * @param name Object name.
 * @param typePath Component type path.
 * @returns Object.
 */
export function logicTestEntityCreate(name: string, typePath: string): THREE.Group {
  const entity = new THREE.Group();
  entity.name = name;
  GameEntityComponentStore.write(entity, { [typePath]: {} });
  return entity;
}

/**
 * Creates a button and doors named `door_a`, `door_b` and so on.
 *
 * @param doorCount Number of doors.
 * @returns Button and doors, not yet in a world.
 */
export function logicTestSceneCreate(doorCount: number): LogicTestScene {
  const doors = Array.from({ length: doorCount }, (_unused, index) =>
    logicTestEntityCreate(`door_${String.fromCharCode(97 + index)}`, TEST_DOOR_TYPE_PATH),
  );
  return { button: logicTestEntityCreate('button_main', TEST_BUTTON_TYPE_PATH), doors };
}

/**
 * Creates a sanitized output row with defaults for the fields not given.
 *
 * @param fields Fields to set.
 * @returns Output row.
 */
export function logicTestRowCreate(fields: Partial<AuthoredLogicOutput>): AuthoredLogicOutput {
  return GameEntityLogicStore.rowSanitize({
    output: 'OnPressed',
    target: '',
    input: '',
    parameter: '',
    delay: 0,
    times_to_fire: -1,
    ...fields,
  });
}
