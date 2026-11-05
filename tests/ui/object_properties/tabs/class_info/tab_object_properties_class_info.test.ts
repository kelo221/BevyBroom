import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EntityClassRegistry } from '@/entity/class/registry/entity_class_registry.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { TabObjectPropertiesClassInfo } from '@/ui/object_properties/tabs/class_info/tab_object_properties_class_info.js';
import {
  KEYVALUE_TABLE_GROUP_ROW_CLASS,
  KEYVALUE_TABLE_NAME_CELL_CLASS,
  KEYVALUE_TABLE_ROW_CLASS,
} from '@/ui/object_properties/tabs/class_info/keyvalues/object_properties_keyvalue_table_styles.js';
import { gameEntityClassIdOf } from '@/game_entity/class/game_entity_class_id.js';
import { GAME_ENTITY_PROPERTIES_TYPE_PATH } from '@/game_entity/class/game_entity_class_provider_builtin.js';
import { PANEL_PROPERTIES_ROW_INDENT_PROPERTY } from '@/ui/properties/panel_properties_row.js';
import {
  TEST_DOOR_TYPE_PATH,
  testClassListCreate,
  testClassesInstall,
} from '../../../../game_entity/game_entity_test_classes.js';
import {
  objectPropertiesTestContextCreate,
  objectPropertiesTestFieldType,
  objectPropertiesTestForwardRead,
  objectPropertiesTestQuery,
} from '../../object_properties_test_support.js';

/**
 * Creates a door game entity with the door class.
 *
 * @param name Entity name.
 * @returns Door entity.
 */
function doorCreate(name: string): THREE.Group {
  const door = GameEntityOwner.createDefault(name);
  door.name = name;
  GameEntityComponentStore.write(door, { [TEST_DOOR_TYPE_PATH]: {} });
  return door;
}

/**
 * Creates an owner of the point class with a label.
 *
 * @param label Point class label.
 * @returns New entity owner.
 */
function pointClassCreate(label: string): THREE.Group {
  const pointClass = EntityClassRegistry.pointClassesList().find((entityClass) => entityClass.label === label);
  if (!pointClass) throw new Error(`expected a point class labelled ${label}`);
  return pointClass.ownerCreate();
}

/**
 * Mounts the Class Info tab on objects and shows them.
 *
 * @param objects Edited objects.
 * @returns Tab, its container and the test context.
 */
function classInfoMount(objects: readonly THREE.Object3D[]): {
  tab: TabObjectPropertiesClassInfo;
  container: HTMLElement;
  rig: ReturnType<typeof objectPropertiesTestContextCreate>;
} {
  const rig = objectPropertiesTestContextCreate(objects);
  const tab = new TabObjectPropertiesClassInfo(rig.context);
  tab.refresh(objects);
  return { tab, container: rig.context.container, rig };
}

/**
 * The Class Info tab changes the class from its Class combo, lists the name,
 * light settings and game component fields as keyvalue rows with field editors
 * or, with SmartEdit off, as raw text, edits the selected row from the value
 * box, explains the class, sets angles with the combo, dial and Point At, and
 * stores comments, each as an undoable edit.
 */
describe('TabObjectPropertiesClassInfo', () => {
  let uninstall: () => void = () => {};

  beforeEach(() => {
    const list = testClassListCreate();
    const door = list.classes.find((entry) => entry.type_path === TEST_DOOR_TYPE_PATH);
    if (door) {
      door.outputs = [{ name: 'OnOpen', description: 'Fires when the door opens' }];
      door.inputs = [{ name: 'Open', description: 'Opens the door' }];
    }
    uninstall = testClassesInstall(list).uninstall;
  });

  afterEach(() => {
    uninstall();
  });

  it('renames the object and keeps outputs that target it pointing at the new name', () => {
    const door = doorCreate('door_a');
    const { container, rig } = classInfoMount([door]);
    const button = new THREE.Group();
    rig.worldObject.add(button);
    GameEntityLogicStore.write(button, [
      { output: 'OnPressed', target: 'door_a', input: 'Open', parameter: '', delay: 0, times_to_fire: -1 },
    ]);
    objectPropertiesTestFieldType(objectPropertiesTestQuery(container, 'input[aria-label="Name"]'), 'door_b');
    expect(door.name).toBe('door_b');
    expect(GameEntityLogicStore.read(button)[0]?.target).toBe('door_b');
    rig.commandStack.undo();
    expect(door.name).toBe('door_a');
    expect(GameEntityLogicStore.read(button)[0]?.target).toBe('door_a');
  });

  it('edits a game component field through one undoable command', () => {
    const door = doorCreate('door');
    const { container, rig } = classInfoMount([door]);
    const uses = objectPropertiesTestQuery<HTMLInputElement>(
      container,
      `[data-game-component="${TEST_DOOR_TYPE_PATH}"] [data-field-path="uses"] input`,
    );
    objectPropertiesTestFieldType(uses, '9');
    expect(GameEntityComponentStore.read(door)).toEqual({ [TEST_DOOR_TYPE_PATH]: { uses: 9 } });
    expect(rig.commandStack.getUndoCount()).toBe(1);
  });

  it('describes the class once with its category and pin descriptions', () => {
    const { container } = classInfoMount([doorCreate('door')]);
    const help = objectPropertiesTestQuery(
      container,
      `[data-help-class-id="${gameEntityClassIdOf(TEST_DOOR_TYPE_PATH)}"]`,
    );
    expect(help.textContent).toContain('Door (Doors)');
    expect(help.textContent).toContain('Fires when the door opens');
    expect(help.textContent).toContain('Opens the door');
    expect(container.querySelector(`[data-help-type-path="${TEST_DOOR_TYPE_PATH}"]`)).toBeNull();
    const helpBox = objectPropertiesTestQuery(container, '.object-properties-class-help');
    expect(helpBox.textContent?.split('Door (Doors)').length).toBe(2);
  });

  it('wraps long help text instead of scrolling sideways', () => {
    const { container } = classInfoMount([doorCreate('door')]);
    const helpBox = objectPropertiesTestQuery<HTMLElement>(container, '.object-properties-class-help');
    expect(helpBox.style.overflowX).toBe('hidden');
    expect(helpBox.style.overflowWrap).toBe('anywhere');
  });

  it('presents field rows as grid rows and component titles as group rows of the table', () => {
    const { container } = classInfoMount([doorCreate('door')]);
    const table = objectPropertiesTestQuery(container, '[role="table"][aria-label="Keyvalues"]');
    const nameRow = objectPropertiesTestQuery<HTMLElement>(table, '[data-properties-row="Name"]');
    expect(nameRow.classList.contains(KEYVALUE_TABLE_ROW_CLASS)).toBe(true);
    expect(nameRow.firstElementChild?.classList.contains(KEYVALUE_TABLE_NAME_CELL_CLASS)).toBe(true);
    const groupRows = [...table.querySelectorAll<HTMLElement>('[data-properties-group-row]')];
    expect(groupRows.length).toBeGreaterThan(0);
    groupRows.forEach((row) => expect(row.classList.contains(KEYVALUE_TABLE_GROUP_ROW_CLASS)).toBe(true));
    const rows = [...table.querySelectorAll<HTMLElement>(`.${KEYVALUE_TABLE_ROW_CLASS}`)].filter(
      (row) => row.closest('[style*="display: none"]') === null,
    );
    expect(rows[rows.length - 1]?.dataset['propertiesRow']).toBe('Add');
    nameRow.dispatchEvent(new Event('pointerdown'));
    expect(nameRow.dataset['keyvalueRowSelected']).toBe('true');
  });

  it('turns the object with the angles combo and refreshes the editor transforms', () => {
    const door = doorCreate('door');
    const { container, rig } = classInfoMount([door]);
    objectPropertiesTestFieldType(
      objectPropertiesTestQuery(container, '.widget-angles-compass input[aria-label="Angles"]'),
      '90',
    );
    expect(objectPropertiesTestForwardRead(door).distanceTo(new THREE.Vector3(-1, 0, 0))).toBeLessThan(1e-6);
    expect(rig.afterTransformCommit).toHaveBeenCalledWith([door]);
    rig.commandStack.undo();
    expect(objectPropertiesTestForwardRead(door).distanceTo(new THREE.Vector3(0, 0, -1))).toBeLessThan(1e-6);
  });

  it('points the object straight up from the Up choice of the angles combo', () => {
    const door = doorCreate('door');
    const { container } = classInfoMount([door]);
    objectPropertiesTestFieldType(
      objectPropertiesTestQuery(container, '.widget-angles-compass input[aria-label="Angles"]'),
      'Up',
    );
    expect(objectPropertiesTestForwardRead(door).distanceTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(1e-6);
  });

  it('shows the settings of a light as keyvalue rows that edit the light', () => {
    const light = pointClassCreate('Point Light');
    const radius = LightOwner.settingsRead(light)?.radius ?? 0;
    const { container, rig } = classInfoMount([light]);
    const table = objectPropertiesTestQuery(container, '[role="table"][aria-label="Keyvalues"]');
    const radiusRow = objectPropertiesTestQuery<HTMLElement>(table, '[data-properties-row="Radius"]');
    const radiusInput = objectPropertiesTestQuery<HTMLInputElement>(radiusRow, 'input');
    expect(Number(radiusInput.value)).toBeCloseTo(radius);
    objectPropertiesTestFieldType(radiusInput, String(radius + 2));
    expect(LightOwner.settingsRead(light)?.radius).toBeCloseTo(radius + 2);
    rig.commandStack.undo();
    expect(LightOwner.settingsRead(light)?.radius).toBeCloseTo(radius);
  });

  it('lists the name first and hides the game components of other objects from a light', () => {
    const { container } = classInfoMount([pointClassCreate('Point Light')]);
    const rows = [...container.querySelectorAll<HTMLElement>('[role="table"] [data-properties-row]')].filter(
      (row) => row.closest('[style*="display: none"]') === null,
    );
    expect(rows[0]?.dataset['propertiesRow']).toBe('Name');
    expect(container.querySelector(`[data-game-component="${TEST_DOOR_TYPE_PATH}"]`)).toBeNull();
  });

  it('shows raw keys and text values with SmartEdit off and commits typed text', () => {
    const light = pointClassCreate('Point Light');
    const radius = LightOwner.settingsRead(light)?.radius ?? 0;
    const { container, rig } = classInfoMount([light]);
    const smartEdit = objectPropertiesTestQuery<HTMLButtonElement>(
      container,
      '[data-object-properties-action="smart-edit"]',
    );
    smartEdit.click();
    expect(smartEdit.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('[data-properties-row="Radius"]')).toBeNull();
    const radiusText = objectPropertiesTestQuery<HTMLInputElement>(container, '[data-keyvalue-key="radius"] input');
    expect(Number(radiusText.value)).toBe(radius);
    expect(container.querySelector('[data-keyvalue-key="targetname"]')).not.toBeNull();
    objectPropertiesTestFieldType(radiusText, String(radius + 1));
    expect(LightOwner.settingsRead(light)?.radius).toBe(radius + 1);
    expect(rig.commandStack.getUndoCount()).toBe(1);
    smartEdit.click();
    expect(container.querySelector('[data-properties-row="Radius"]')).not.toBeNull();
  });

  it('lists game component fields under their class with SmartEdit off', () => {
    const door = doorCreate('door');
    const { container } = classInfoMount([door]);
    objectPropertiesTestQuery<HTMLButtonElement>(container, '[data-object-properties-action="smart-edit"]').click();
    const uses = objectPropertiesTestQuery<HTMLInputElement>(container, '[data-keyvalue-key="Door.uses"] input');
    objectPropertiesTestFieldType(uses, '4');
    expect(GameEntityComponentStore.read(door)).toEqual({ [TEST_DOOR_TYPE_PATH]: { uses: 4 } });
  });

  it('shows the selected row in the value box and edits it from there', () => {
    const door = doorCreate('door_a');
    const { container } = classInfoMount([door]);
    const nameRow = objectPropertiesTestQuery<HTMLElement>(container, '[role="table"] [data-properties-row="Name"]');
    nameRow.dispatchEvent(new Event('pointerdown'));
    const valueBox = objectPropertiesTestQuery<HTMLInputElement>(container, 'input[aria-label="Selected value"]');
    expect(valueBox.disabled).toBe(false);
    expect(valueBox.value).toBe('door_a');
    objectPropertiesTestFieldType(valueBox, 'door_b');
    expect(door.name).toBe('door_b');
    const help = objectPropertiesTestQuery(container, '[data-help-keyvalue="Name"]');
    expect(help.textContent).toContain('Name');
  });

  it('hides and shows the help box with the Help toggle', () => {
    const { container } = classInfoMount([doorCreate('door')]);
    const helpBox = objectPropertiesTestQuery<HTMLElement>(container, '[data-object-properties-section="Help"]');
    const helpToggle = objectPropertiesTestQuery<HTMLButtonElement>(
      container,
      '[data-object-properties-action="help"]',
    );
    helpToggle.click();
    expect(helpBox.hidden).toBe(true);
    helpToggle.click();
    expect(helpBox.hidden).toBe(false);
  });

  it('shows the class in the Class combo and converts the object to a picked class as one edit', () => {
    const door = doorCreate('door');
    GameEntityLogicStore.commentsWrite(door, 'Keep me');
    const { tab, container, rig } = classInfoMount([door]);
    const classCombo = objectPropertiesTestQuery<HTMLInputElement>(container, 'input[aria-label="Class"]');
    expect(classCombo.value).toBe('Door');
    const suggestions = [
      ...container.querySelectorAll<HTMLOptionElement>(`#${classCombo.getAttribute('list') ?? ''} option`),
    ];
    expect(suggestions.map((option) => option.value)).toEqual(expect.arrayContaining(['Point Light', 'Door']));
    expect(suggestions.map((option) => option.value)).not.toContain('Solid (world)');
    objectPropertiesTestFieldType(classCombo, 'point light');
    expect(LightOwner.isOwner(door)).toBe(true);
    expect(GameEntityLogicStore.commentsRead(door)).toBe('Keep me');
    expect(rig.commandStack.getUndoCount()).toBe(1);
    tab.refresh([door]);
    expect(classCombo.value).toBe('Point Light');
    expect(container.querySelector('[role="table"] [data-properties-row="Radius"]')).not.toBeNull();
    rig.commandStack.undo();
    expect(GameEntityComponentStore.read(door)).toEqual({ [TEST_DOOR_TYPE_PATH]: {} });
    expect(LightOwner.isOwner(door)).toBe(false);
  });

  it('offers no data-only class in the Class combo but still shows one an object already has', () => {
    const dataOnly = GameEntityOwner.createDefault('notes');
    GameEntityComponentStore.write(dataOnly, { [GAME_ENTITY_PROPERTIES_TYPE_PATH]: {} });
    const { container } = classInfoMount([dataOnly]);
    const classCombo = objectPropertiesTestQuery<HTMLInputElement>(container, 'input[aria-label="Class"]');
    const suggestions = [
      ...container.querySelectorAll<HTMLOptionElement>(`#${classCombo.getAttribute('list') ?? ''} option`),
    ].map((option) => option.value);
    expect(suggestions).toEqual(expect.arrayContaining(['Point Light', 'Door']));
    expect(suggestions).not.toContain('Properties');
    expect(classCombo.value).toBe('Properties');
  });

  it('shows light setting groups as group rows of the table with indented rows under them', () => {
    const { container } = classInfoMount([pointClassCreate('Point Light')]);
    const table = objectPropertiesTestQuery(container, '[role="table"][aria-label="Keyvalues"]');
    const groupTitles = [...table.querySelectorAll<HTMLElement>(`.${KEYVALUE_TABLE_GROUP_ROW_CLASS}`)].map((row) =>
      row.textContent?.trim(),
    );
    expect(groupTitles).toEqual(expect.arrayContaining(['Effect', 'Baking']));
    const indents = [...table.querySelectorAll<HTMLElement>(`.${KEYVALUE_TABLE_ROW_CLASS}`)].map((row) =>
      row.style.getPropertyValue(PANEL_PROPERTIES_ROW_INDENT_PROPERTY),
    );
    expect(indents.some((indent) => indent !== '' && indent !== '0px')).toBe(true);
  });

  it('records nothing for a typed class name no class has', () => {
    const door = doorCreate('door');
    const { container, rig } = classInfoMount([door]);
    const classCombo = objectPropertiesTestQuery<HTMLInputElement>(container, 'input[aria-label="Class"]');
    objectPropertiesTestFieldType(classCombo, 'no such class');
    expect(rig.commandStack.getUndoCount()).toBe(0);
    expect(classCombo.value).toBe('Door');
  });

  it('points the object at a picked object', () => {
    const door = doorCreate('door');
    const { container, rig } = classInfoMount([door]);
    const target = new THREE.Group();
    target.position.set(door.position.x + 4, door.position.y + 4, door.position.z);
    rig.worldObject.add(target);
    objectPropertiesTestQuery<HTMLButtonElement>(container, '[data-object-properties-action="point-at"]').click();
    const onPicked = rig.pickRequests[rig.pickRequests.length - 1];
    if (!onPicked) throw new Error('Point At asks for a pick');
    onPicked(target);
    const expected = target.position.clone().sub(door.position).normalize();
    expect(objectPropertiesTestForwardRead(door).distanceTo(expected)).toBeLessThan(1e-6);
  });

  it('stores comments as one undoable edit', () => {
    const door = doorCreate('door');
    const { container, rig } = classInfoMount([door]);
    objectPropertiesTestFieldType(
      objectPropertiesTestQuery(container, 'textarea[aria-label="Comments"]'),
      'Locked door',
    );
    expect(GameEntityLogicStore.commentsRead(door)).toBe('Locked door');
    expect(rig.markDirty).toHaveBeenCalled();
    rig.commandStack.undo();
    expect(GameEntityLogicStore.commentsRead(door)).toBe('');
  });

  it('keeps comments being typed when the tab refreshes for the same objects', () => {
    const door = doorCreate('door');
    const { tab, container } = classInfoMount([door]);
    document.body.appendChild(container);
    const comments = objectPropertiesTestQuery<HTMLTextAreaElement>(container, 'textarea[aria-label="Comments"]');
    comments.focus();
    comments.value = 'Half typed';
    tab.refresh([door]);
    expect(comments.value).toBe('Half typed');
    const otherDoor = doorCreate('other_door');
    GameEntityLogicStore.commentsWrite(otherDoor, 'Other notes');
    tab.refresh([otherDoor]);
    expect(comments.value).toBe('Other notes');
    container.remove();
  });
});
