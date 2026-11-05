import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameEntityLogicMatcher } from '@/game_entity/logic/game_entity_logic_matcher.js';
import { GameEntityLogicPins } from '@/game_entity/logic/game_entity_logic_pins.js';
import { LOGIC_UNIVERSAL_INPUT_NAMES } from '@/game_entity/logic/game_entity_logic_types.js';
import {
  logicTestClassesInstall,
  logicTestSceneCreate,
  TEST_BUTTON_OUTPUT_PINS,
  TEST_DOOR_INPUT_PINS,
} from './game_entity_logic_test_support.js';

/**
 * Objects offer the outputs and inputs their game classes declare, every object
 * accepts the universal inputs, and the target names list the scene's names.
 */
describe('GameEntityLogicPins', () => {
  let uninstall: () => void = () => {};

  beforeEach(() => {
    uninstall = logicTestClassesInstall();
  });

  afterEach(() => uninstall());

  it('lists the outputs declared by the classes of an object', () => {
    const { button, doors } = logicTestSceneCreate(1);
    expect(GameEntityLogicPins.outputsOfObject(button)).toEqual(TEST_BUTTON_OUTPUT_PINS);
    expect(GameEntityLogicPins.outputsOfObject(doors[0] ?? new THREE.Group())).toEqual([]);
  });

  it('lists declared inputs once across several targets, followed by the universal inputs', () => {
    const { doors } = logicTestSceneCreate(2);
    const names = GameEntityLogicPins.inputsOfObjects(doors).map((pin) => pin.name);
    expect(names).toEqual([...TEST_DOOR_INPUT_PINS.map((pin) => pin.name), ...LOGIC_UNIVERSAL_INPUT_NAMES]);
    expect(GameEntityLogicPins.inputsOfObjects([]).map((pin) => pin.name)).toEqual([...LOGIC_UNIVERSAL_INPUT_NAMES]);
    GameEntityLogicPins.universalInputsList().forEach((pin) => expect(pin.description).not.toBe(''));
  });

  it('lists !self and every distinct object name as target names', () => {
    const { button, doors } = logicTestSceneCreate(2);
    const world = new THREE.Group();
    const unnamed = new THREE.Group();
    const duplicate = new THREE.Group();
    duplicate.name = button.name;
    world.add(button, ...doors, unnamed, duplicate);
    const expected = ['!self', ...[button.name, ...doors.map((door) => door.name)].sort()];
    expect(GameEntityLogicMatcher.targetNamesList(world)).toEqual(expected);
  });
});
