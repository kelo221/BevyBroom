import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import { LOGIC_UNIVERSAL_INPUT_NAMES } from '@/game_entity/logic/game_entity_logic_types.js';
import { ObjectPropertiesLogicOutputsClipboard } from '@/game_entity/ui/object_properties/outputs/object_properties_logic_outputs_clipboard.js';
import { TabObjectPropertiesOutputs } from '@/game_entity/ui/object_properties/outputs/tab_object_properties_outputs.js';
import type { ObjectPropertiesTabInstance } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import {
  objectPropertiesTestContextCreate,
  objectPropertiesTestFieldType,
  objectPropertiesTestQuery,
  type ObjectPropertiesTestContext,
} from '../../../../ui/object_properties/object_properties_test_support.js';
import {
  logicTestClassesInstall,
  logicTestRowCreate,
  logicTestSceneCreate,
  TEST_BUTTON_OUTPUT_PINS,
  TEST_DOOR_INPUT_PINS,
  type LogicTestScene,
} from '../../../logic/game_entity_logic_test_support.js';
import { logicTestButtonClick, logicTestTableRowsRead } from '../object_properties_logic_test_support.js';

/** Mounted Outputs tab with its scene and context. */
interface OutputsTabRig {
  readonly tab: ObjectPropertiesTabInstance;
  readonly scene: LogicTestScene;
  readonly test: ObjectPropertiesTestContext;
  readonly root: HTMLElement;
}

/**
 * Builds a scene with a button and doors, mounts the Outputs tab on the button
 * and refreshes it.
 *
 * @param doorCount Number of doors in the scene.
 * @returns Mounted tab rig.
 */
function outputsTabRigCreate(doorCount: number): OutputsTabRig {
  const scene = logicTestSceneCreate(doorCount);
  const test = objectPropertiesTestContextCreate([scene.button]);
  scene.doors.forEach((door) => test.worldObject.add(door));
  const tab = TabObjectPropertiesOutputs.registrationCreate().mount(test.context);
  tab.refresh([scene.button]);
  document.body.appendChild(test.context.container);
  return { tab, scene, test, root: test.context.container };
}

/**
 * Types a value into one row editor field.
 *
 * @param root Tab container.
 * @param ariaLabel Accessible name of the field.
 * @param value Typed value.
 */
function editorFieldType(root: HTMLElement, ariaLabel: string, value: string): void {
  objectPropertiesTestFieldType(
    objectPropertiesTestQuery<HTMLInputElement>(root, `input[aria-label="${ariaLabel}"]`),
    value,
  );
}

/**
 * Returns the values suggested by one row editor field.
 *
 * @param root Tab container.
 * @param ariaLabel Accessible name of the field.
 * @returns Suggested values.
 */
function editorSuggestionsRead(root: HTMLElement, ariaLabel: string): string[] {
  const input = objectPropertiesTestQuery<HTMLInputElement>(root, `input[aria-label="${ariaLabel}"]`);
  const listId = input.getAttribute('list') ?? '';
  const list = objectPropertiesTestQuery<HTMLDataListElement>(root, `datalist[id="${listId}"]`);
  return Array.from(list.options, (option) => option.value);
}

/**
 * The Outputs tab lists the edited object's connections with their target
 * status, edits them through undoable commands and picks, marks and suggests
 * targets and inputs from the scene and the game classes.
 */
describe('TabObjectPropertiesOutputs', () => {
  let uninstall: () => void = () => {};
  let rig: OutputsTabRig | null = null;

  beforeEach(() => {
    uninstall = logicTestClassesInstall();
    ObjectPropertiesLogicOutputsClipboard.clear();
  });

  afterEach(() => {
    rig?.tab.dispose();
    rig = null;
    uninstall();
    document.body.replaceChildren();
  });

  it('adds a row firing the first declared output, edits it and deletes it, each as one undo step', () => {
    rig = outputsTabRigCreate(1);
    const { root, scene, test } = rig;
    const door = scene.doors[0] as THREE.Object3D;
    logicTestButtonClick(root, 'add');
    const firstOutputName = TEST_BUTTON_OUTPUT_PINS[0]?.name ?? '';
    expect(GameEntityLogicStore.read(scene.button)).toEqual([logicTestRowCreate({ output: firstOutputName })]);
    editorFieldType(root, 'Targets entities named', door.name);
    editorFieldType(root, 'Via this input', 'Open');
    editorFieldType(root, 'After a delay in seconds of', '1.5');
    objectPropertiesTestQuery<HTMLInputElement>(root, 'input[aria-label="Fire once only"]').click();
    const expected = logicTestRowCreate({ target: door.name, input: 'Open', delay: 1.5, times_to_fire: 1 });
    expect(GameEntityLogicStore.read(scene.button)).toEqual([expected]);
    expect(logicTestTableRowsRead(root, 'Outputs')).toHaveLength(1);
    const undoCountBeforeDelete = test.commandStack.getUndoCount();
    logicTestButtonClick(root, 'delete');
    expect(GameEntityLogicStore.read(scene.button)).toEqual([]);
    expect(logicTestTableRowsRead(root, 'Outputs')).toHaveLength(0);
    test.commandStack.undo();
    expect(test.commandStack.getUndoCount()).toBe(undoCountBeforeDelete);
    expect(GameEntityLogicStore.read(scene.button)).toEqual([expected]);
  });

  it('shows a red badge on a row whose target matches nothing', () => {
    rig = outputsTabRigCreate(1);
    GameEntityLogicStore.write(rig.scene.button, [logicTestRowCreate({ target: 'nothing_has_this_name' })]);
    rig.tab.refresh([rig.scene.button]);
    const [row] = logicTestTableRowsRead(rig.root, 'Outputs');
    expect(row?.dataset['logicStatus']).toBe('broken');
    expect(row?.querySelector('.object-properties-logic-badge')).not.toBeNull();
    expect(row?.style.color).not.toBe('inherit');
  });

  it('draws a wildcard target that matches several objects in bold', () => {
    rig = outputsTabRigCreate(2);
    const singleName = rig.scene.doors[0]?.name ?? '';
    GameEntityLogicStore.write(rig.scene.button, [
      logicTestRowCreate({ target: 'door_*' }),
      logicTestRowCreate({ target: singleName }),
    ]);
    rig.tab.refresh([rig.scene.button]);
    const [wildcardRow, singleRow] = logicTestTableRowsRead(rig.root, 'Outputs');
    expect(wildcardRow?.dataset['logicStatus']).toBe('valid_multiple');
    expect((wildcardRow?.cells[1] as HTMLElement | undefined)?.style.fontWeight).toBe('700');
    expect(wildcardRow?.querySelector('.object-properties-logic-badge')).toBeNull();
    expect(singleRow?.dataset['logicStatus']).toBe('valid_single');
    expect((singleRow?.cells[1] as HTMLElement | undefined)?.style.fontWeight).toBe('normal');
  });

  it('fills the target with the name of the object picked with the eyedropper', () => {
    rig = outputsTabRigCreate(2);
    logicTestButtonClick(rig.root, 'add');
    logicTestButtonClick(rig.root, 'pick-target');
    expect(rig.test.pickRequests).toHaveLength(1);
    const picked = rig.scene.doors[1] as THREE.Object3D;
    rig.test.pickRequests[0]?.(picked);
    expect(GameEntityLogicStore.read(rig.scene.button)[0]?.target).toBe(picked.name);
    expect(
      objectPropertiesTestQuery<HTMLInputElement>(rig.root, 'input[aria-label="Targets entities named"]').value,
    ).toBe(picked.name);
  });

  it('marks every object the selected target matches', () => {
    rig = outputsTabRigCreate(3);
    GameEntityLogicStore.write(rig.scene.button, [logicTestRowCreate({ target: 'door_*' })]);
    rig.tab.refresh([rig.scene.button]);
    logicTestButtonClick(rig.root, 'mark-targets');
    const marked = rig.test.markRequests[rig.test.markRequests.length - 1];
    expect(new Set(marked?.objects)).toEqual(new Set(rig.scene.doors));
    expect(marked?.shouldFrame).toBe(false);
  });

  it('suggests the source outputs, the target class inputs with the universal inputs and the scene names', () => {
    rig = outputsTabRigCreate(1);
    const door = rig.scene.doors[0] as THREE.Object3D;
    GameEntityLogicStore.write(rig.scene.button, [logicTestRowCreate({ target: door.name })]);
    rig.tab.refresh([rig.scene.button]);
    expect(editorSuggestionsRead(rig.root, 'My output named')).toEqual(TEST_BUTTON_OUTPUT_PINS.map((pin) => pin.name));
    expect(editorSuggestionsRead(rig.root, 'Via this input')).toEqual([
      ...TEST_DOOR_INPUT_PINS.map((pin) => pin.name),
      ...LOGIC_UNIVERSAL_INPUT_NAMES,
    ]);
    expect(editorSuggestionsRead(rig.root, 'Targets entities named')).toEqual(
      expect.arrayContaining(['!self', door.name, rig.scene.button.name]),
    );
  });

  it('copies the selected row and pastes it onto another object', () => {
    rig = outputsTabRigCreate(1);
    const copiedRow = logicTestRowCreate({ target: '!self', input: 'Disable', parameter: 'now' });
    GameEntityLogicStore.write(rig.scene.button, [copiedRow]);
    rig.tab.refresh([rig.scene.button]);
    logicTestButtonClick(rig.root, 'copy');
    const otherObject = rig.scene.doors[0] as THREE.Object3D;
    rig.tab.refresh([otherObject]);
    logicTestButtonClick(rig.root, 'paste');
    expect(GameEntityLogicStore.read(otherObject)).toEqual([copiedRow]);
  });

  it('selects a row by clicking it and shows it in the editor', () => {
    rig = outputsTabRigCreate(2);
    const names = rig.scene.doors.map((door) => door.name);
    GameEntityLogicStore.write(
      rig.scene.button,
      names.map((target) => logicTestRowCreate({ target })),
    );
    rig.tab.refresh([rig.scene.button]);
    logicTestTableRowsRead(rig.root, 'Outputs')[1]?.click();
    expect(logicTestTableRowsRead(rig.root, 'Outputs')[1]?.getAttribute('aria-selected')).toBe('true');
    expect(
      objectPropertiesTestQuery<HTMLInputElement>(rig.root, 'input[aria-label="Targets entities named"]').value,
    ).toBe(names[1]);
  });

  it('asks for a single object and disables editing when several objects are edited', () => {
    rig = outputsTabRigCreate(2);
    rig.tab.refresh(rig.scene.doors);
    expect(rig.root.textContent).toContain('Select a single object');
    expect(objectPropertiesTestQuery<HTMLButtonElement>(rig.root, '[data-logic-action="add"]').disabled).toBe(true);
    expect(objectPropertiesTestQuery<HTMLInputElement>(rig.root, 'input[aria-label="My output named"]').disabled).toBe(
      true,
    );
  });
});
