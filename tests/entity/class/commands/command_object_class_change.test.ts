import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { CommandObjectClassChange } from '@/entity/class/commands/command_object_class_change.js';
import { type EntityClass, EntityClassPoint } from '@/entity/class/entity_class.js';
import { EntityClassObjectStateStore } from '@/entity/class/entity_class_object_state.js';
import { EntityClassRegistry } from '@/entity/class/registry/entity_class_registry.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { VISGROUP_IDS_USERDATA_KEY } from '@/visgroup/visgroup_types.js';
import {
  TEST_DOOR_TYPE_PATH,
  TEST_SPINNER_TYPE_PATH,
  testClassesInstall,
} from '../../../game_entity/game_entity_test_classes.js';

/**
 * Returns the class with a label and placement or fails the test.
 *
 * @param label Class label.
 * @param placement Point or brush.
 * @returns Class.
 */
function classByLabel(label: string, placement: 'point' | 'brush'): EntityClass {
  const found = EntityClassRegistry.classesList().find(
    (entityClass) => entityClass.label === label && entityClass.placement === placement,
  );
  if (!found) throw new Error(`expected a ${placement} class labelled ${label}`);
  return found;
}

/**
 * Creates a door entity with a name, a turned and moved transform, an override,
 * comments, one output and one VisGroup, inside a parent at a known index.
 *
 * @returns Door, its parent and its index in the parent.
 */
function doorAuthoredCreate(): { door: THREE.Group; parent: THREE.Group; index: number } {
  const parent = new THREE.Group();
  parent.add(new THREE.Group());
  const door = GameEntityOwner.createDefault('front_door');
  door.name = 'front_door';
  door.position.set(3, 1, -2);
  door.rotation.set(0, Math.PI / 3, 0);
  GameEntityComponentStore.write(door, { [TEST_DOOR_TYPE_PATH]: { uses: 9 } });
  GameEntityLogicStore.commentsWrite(door, 'Main entrance');
  GameEntityLogicStore.write(door, [
    { output: 'OnOpen', target: 'hall_light', input: 'TurnOn', parameter: '', delay: 0, times_to_fire: -1 },
  ]);
  door.userData[VISGROUP_IDS_USERDATA_KEY] = ['user_visgroup_entrance'];
  parent.add(door);
  parent.add(new THREE.Group());
  return { door, parent, index: parent.children.indexOf(door) };
}

/**
 * Class changes convert objects in place: identity, name, transform, place in
 * the scene, comments, outputs and VisGroups stay, the class state changes, and
 * undo restores the previous class state exactly.
 */
describe('CommandObjectClassChange', () => {
  let uninstall: () => void = () => {};

  beforeEach(() => {
    uninstall = testClassesInstall().uninstall;
  });

  afterEach(() => {
    uninstall();
  });

  it('turns a game entity into a point light and keeps everything that is not its class', () => {
    const { door, parent, index } = doorAuthoredCreate();
    const uuid = door.uuid;
    const position = door.position.clone();
    const quaternion = door.quaternion.clone();
    const stack = new CommandStack(16);
    stack.push(new CommandObjectClassChange([door], classByLabel('Point Light', 'point')));
    expect(LightOwner.isOwner(door)).toBe(true);
    expect(EntityClassRegistry.classOf(door)?.label).toBe('Point Light');
    expect(GameEntityComponentStore.read(door)).not.toHaveProperty(TEST_DOOR_TYPE_PATH);
    expect(door.uuid).toBe(uuid);
    expect(door.name).toBe('front_door');
    expect(door.position.equals(position)).toBe(true);
    expect(door.quaternion.angleTo(quaternion)).toBeLessThan(1e-9);
    expect(parent.children.indexOf(door)).toBe(index);
    expect(GameEntityLogicStore.commentsRead(door)).toBe('Main entrance');
    expect(GameEntityLogicStore.read(door).map((row) => row.target)).toEqual(['hall_light']);
    expect(door.userData[VISGROUP_IDS_USERDATA_KEY]).toEqual(['user_visgroup_entrance']);
  });

  it('restores the exact game entity on undo and converts again on redo', () => {
    const { door } = doorAuthoredCreate();
    const before = EntityClassObjectStateStore.capture(door);
    const stack = new CommandStack(16);
    stack.push(new CommandObjectClassChange([door], classByLabel('Point Light', 'point')));
    const after = EntityClassObjectStateStore.capture(door);
    stack.undo();
    expect(EntityClassObjectStateStore.equals(EntityClassObjectStateStore.capture(door), before)).toBe(true);
    expect(GameEntityOwner.isOwner(door)).toBe(true);
    expect(EntityClassRegistry.classOf(door)?.label).toBe('Door');
    stack.redo();
    expect(EntityClassObjectStateStore.equals(EntityClassObjectStateStore.capture(door), after)).toBe(true);
  });

  it('swaps only the class component when a game entity changes game class', () => {
    const { door } = doorAuthoredCreate();
    new CommandObjectClassChange([door], classByLabel('Spinner', 'point')).execute();
    expect(GameEntityOwner.isOwner(door)).toBe(true);
    expect(Object.keys(GameEntityComponentStore.read(door))).toEqual([TEST_SPINNER_TYPE_PATH]);
  });

  it('keeps a light setting other than its kind when a point light becomes a spot light', () => {
    const light = classByLabel('Point Light', 'point');
    if (!(light instanceof EntityClassPoint)) throw new Error('the point light is a point class');
    const owner = light.ownerCreate();
    const settings = LightOwner.settingsRead(owner);
    if (!settings) throw new Error('a light has settings');
    LightOwner.settingsWrite(owner, { ...settings, radius: settings.radius + 5 });
    new CommandObjectClassChange([owner], classByLabel('Spot Light', 'point')).execute();
    expect(LightOwner.settingsRead(owner)?.kind).toBe('spot');
    expect(LightOwner.settingsRead(owner)?.radius).toBe(settings.radius + 5);
  });

  it('records nothing when the object already is of the class', () => {
    const { door } = doorAuthoredCreate();
    const before = EntityClassObjectStateStore.capture(door);
    const command = new CommandObjectClassChange([door], classByLabel('Door', 'point'));
    expect(command.hasChanges()).toBe(false);
    expect(EntityClassObjectStateStore.equals(EntityClassObjectStateStore.capture(door), before)).toBe(true);
  });

  it('gives a brush a brush game class and takes it away again with Solid (world)', () => {
    const brush = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    const stack = new CommandStack(16);
    stack.push(new CommandObjectClassChange([brush], classByLabel('Spinner', 'brush')));
    expect(GameEntityComponentStore.read(brush)).toHaveProperty(TEST_SPINNER_TYPE_PATH);
    expect(GameEntityOwner.isOwner(brush)).toBe(false);
    stack.push(new CommandObjectClassChange([brush], classByLabel('Solid (world)', 'brush')));
    expect(GameEntityComponentStore.read(brush)).toEqual({});
    stack.undo();
    expect(EntityClassRegistry.classOf(brush)?.label).toBe('Spinner');
  });

  it('leaves objects alone that the class does not fit', () => {
    const brush = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    const { door } = doorAuthoredCreate();
    expect(new CommandObjectClassChange([brush], classByLabel('Point Light', 'point')).hasChanges()).toBe(false);
    expect(new CommandObjectClassChange([door], classByLabel('Spinner', 'brush')).hasChanges()).toBe(false);
  });
});
