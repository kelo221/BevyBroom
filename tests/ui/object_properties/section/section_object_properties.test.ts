import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { SectionObjectProperties } from '@/ui/object_properties/section/section_object_properties.js';
import { TEST_DOOR_TYPE_PATH, testClassesInstall } from '../../../game_entity/game_entity_test_classes.js';
import {
  objectPropertiesTestFieldType,
  objectPropertiesTestForwardRead,
  objectPropertiesTestQuery,
} from '../object_properties_test_support.js';

/** Section, scene and services one section test works with. */
interface SectionTestRig {
  readonly section: SectionObjectProperties;
  readonly selectionManager: ManagerSelection;
  readonly commandStack: CommandStack;
  readonly worldObject: THREE.Group;
  readonly door: THREE.Group;
  readonly afterWorldMutation: ReturnType<typeof vi.fn>;
  readonly selectionFrame: ReturnType<typeof vi.fn>;
  readonly dockReveal: ReturnType<typeof vi.fn>;
}

/** Rig of the running test, disposed after it. */
let sectionTestRig: SectionTestRig | null = null;

/**
 * Creates a world with a door entity, selects it and builds the section with
 * the built-in tabs, mounted in the document.
 *
 * @returns Test rig.
 */
function sectionRigCreate(): SectionTestRig {
  const worldObject = new THREE.Group();
  const door = GameEntityOwner.createDefault('door_main');
  door.name = 'door_main';
  GameEntityComponentStore.write(door, { [TEST_DOOR_TYPE_PATH]: {} });
  worldObject.add(door);
  const selectionManager = new ManagerSelection();
  selectionManager.setSelection([], [door]);
  const commandStack = new CommandStack(64);
  const afterWorldMutation = vi.fn();
  const selectionFrame = vi.fn();
  const dockReveal = vi.fn();
  const section = new SectionObjectProperties({
    selectionManager,
    commandStack,
    worldObject,
    afterWorldMutation,
    afterTransformCommit: vi.fn(),
    propertiesPanelRead: () => null,
    selectionFrame,
    dockReveal,
  });
  document.body.appendChild(section.getElement());
  sectionTestRig = {
    section,
    selectionManager,
    commandStack,
    worldObject,
    door,
    afterWorldMutation,
    selectionFrame,
    dockReveal,
  };
  return sectionTestRig;
}

/**
 * Edits a component field, the yaw through the compass dial and the comments of
 * the door from the section.
 *
 * @param section Properties section.
 */
function doorLiveEdit(section: SectionObjectProperties): void {
  const root = section.getElement();
  objectPropertiesTestFieldType(
    objectPropertiesTestQuery(root, `[data-game-component="${TEST_DOOR_TYPE_PATH}"] [data-field-path="uses"] input`),
    '9',
  );
  const dial = objectPropertiesTestQuery<SVGSVGElement>(root, 'svg[aria-label="Yaw dial"]');
  const rect = dial.getBoundingClientRect();
  const viewSize = Number(dial.getAttribute('width'));
  const pixelsPerUnit = rect.width > 0 ? rect.width / viewSize : 1;
  dial.dispatchEvent(
    new MouseEvent('click', {
      clientX: rect.left + (viewSize / 2 - 10) * pixelsPerUnit,
      clientY: rect.top + (viewSize / 2) * pixelsPerUnit,
    }),
  );
  objectPropertiesTestFieldType(objectPropertiesTestQuery(root, 'textarea[aria-label="Comments"]'), 'Locked');
}

/**
 * Returns whether the door shows every live edit.
 *
 * @param door Door entity.
 * @returns True when the component, yaw and comments edits are present.
 */
function doorHasEdits(door: THREE.Group): boolean {
  const facesMinusX = objectPropertiesTestForwardRead(door).distanceTo(new THREE.Vector3(-1, 0, 0)) < 1e-6;
  const components = GameEntityComponentStore.read(door);
  const usesEdited = JSON.stringify(components) === JSON.stringify({ [TEST_DOOR_TYPE_PATH]: { uses: 9 } });
  return facesMinusX && usesEdited && GameEntityLogicStore.commentsRead(door) === 'Locked';
}

/**
 * Returns whether the door is back in its state from before the edits.
 *
 * @param door Door entity.
 * @returns True when no edit is left.
 */
function doorIsPristine(door: THREE.Group): boolean {
  const facesForward = objectPropertiesTestForwardRead(door).distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-6;
  const components = JSON.stringify(GameEntityComponentStore.read(door));
  return (
    facesForward &&
    components === JSON.stringify({ [TEST_DOOR_TYPE_PATH]: {} }) &&
    !GameEntityLogicStore.commentsRead(door)
  );
}

/**
 * Clicks an action button inside the section.
 *
 * @param section Properties section.
 * @param action Action name of the button.
 */
function sectionActionClick(section: SectionObjectProperties, action: string): void {
  objectPropertiesTestQuery<HTMLButtonElement>(
    section.getElement(),
    `[data-object-properties-action="${action}"]`,
  ).click();
}

/**
 * The Properties section of the right dock always shows the selection, applies
 * each edit at once as its own undo step, follows selection changes and keeps
 * the Object Properties tabs on one compact row.
 */
describe('SectionObjectProperties', () => {
  let uninstall: () => void = () => {};

  beforeEach(() => {
    uninstall = testClassesInstall().uninstall;
  });

  afterEach(() => {
    sectionTestRig?.section.dispose();
    sectionTestRig = null;
    uninstall();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('titles itself after the selected object and shows a hint with no selection', () => {
    const { section, selectionManager, door, dockReveal } = sectionRigCreate();
    expect(section.getElement().textContent).toContain(`Properties: ${door.name}`);
    expect(section.reveal()).toBe(true);
    expect(dockReveal).toHaveBeenCalledOnce();
    expect(section.editedObjectsRead()).toEqual([door]);
    selectionManager.clearSelection();
    expect(section.editedObjectsRead()).toEqual([]);
    expect(section.getElement().textContent).toContain('Select an object');
    expect(section.reveal()).toBe(false);
  });

  it('applies every edit at once and undoes them one step at a time back to the start', () => {
    const { section, commandStack, door, afterWorldMutation } = sectionRigCreate();
    const undoCountBefore = commandStack.getUndoCount();
    doorLiveEdit(section);
    expect(doorHasEdits(door)).toBe(true);
    expect(commandStack.getUndoCount()).toBeGreaterThan(undoCountBefore);
    expect(afterWorldMutation).toHaveBeenCalled();
    while (commandStack.getUndoCount() > undoCountBefore) {
      commandStack.undo();
    }
    expect(doorIsPristine(door)).toBe(true);
  });

  it('keeps the edits and shows the new selection when the selection changes', () => {
    const { section, selectionManager, worldObject, door } = sectionRigCreate();
    doorLiveEdit(section);
    const other = GameEntityOwner.createDefault('other');
    other.name = 'other';
    worldObject.add(other);
    selectionManager.setSelection([], [other]);
    expect(section.editedObjectsRead()).toEqual([other]);
    expect(section.getElement().textContent).toContain('Properties: other');
    expect(doorHasEdits(door)).toBe(true);
  });

  it('copies the components of one object and pastes them onto another', () => {
    const { section, selectionManager, worldObject, door } = sectionRigCreate();
    GameEntityComponentStore.write(door, { [TEST_DOOR_TYPE_PATH]: { uses: 4 } });
    selectionManager.setSelection([], [door]);
    sectionActionClick(section, 'copy');
    const other = GameEntityOwner.createDefault('other');
    worldObject.add(other);
    selectionManager.setSelection([], [other]);
    sectionActionClick(section, 'paste');
    expect(GameEntityComponentStore.read(other)).toEqual(GameEntityComponentStore.read(door));
  });

  it('adds and edits output rows in the Outputs tab as undoable edits', () => {
    const { section, commandStack, worldObject, door } = sectionRigCreate();
    const relay = GameEntityOwner.createDefault('relay');
    relay.name = 'relay_target';
    worldObject.add(relay);
    const undoCountBefore = commandStack.getUndoCount();
    section.tabShow('outputs');
    const root = section.getElement();
    objectPropertiesTestQuery<HTMLButtonElement>(root, '[data-logic-action="add"]').click();
    objectPropertiesTestFieldType(
      objectPropertiesTestQuery(root, 'input[aria-label="Targets entities named"]'),
      relay.name,
    );
    objectPropertiesTestFieldType(objectPropertiesTestQuery(root, 'input[aria-label="Via this input"]'), 'Enable');
    expect(GameEntityLogicStore.read(door).map((row) => [row.target, row.input])).toEqual([[relay.name, 'Enable']]);
    while (commandStack.getUndoCount() > undoCountBefore) {
      commandStack.undo();
    }
    expect(GameEntityLogicStore.read(door)).toEqual([]);
  });

  it('retargets to the source marked in the Inputs tab and frames it on double-click', () => {
    const { section, selectionManager, worldObject, door, selectionFrame } = sectionRigCreate();
    const button = GameEntityOwner.createDefault('button');
    button.name = 'button_source';
    GameEntityLogicStore.write(button, [
      { output: 'OnPressed', target: door.name, input: 'Open', parameter: '', delay: 0, times_to_fire: -1 },
    ]);
    worldObject.add(button);
    selectionManager.clearSelection();
    selectionManager.setSelection([], [door]);
    section.tabShow('inputs');
    const row = objectPropertiesTestQuery<HTMLTableRowElement>(
      section.getElement(),
      'table[aria-label="Inputs"] tbody tr',
    );
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(selectionManager.getInspectorObjects()).toEqual([button]);
    expect(section.editedObjectsRead()).toEqual([button]);
    expect(selectionFrame).toHaveBeenCalledTimes(1);
  });

  it('changes the class from the Class combo as an undoable edit', () => {
    const { section, commandStack, door } = sectionRigCreate();
    const undoCountBefore = commandStack.getUndoCount();
    const classCombo = objectPropertiesTestQuery<HTMLInputElement>(section.getElement(), 'input[aria-label="Class"]');
    objectPropertiesTestFieldType(classCombo, 'Point Light');
    expect(LightOwner.isOwner(door)).toBe(true);
    expect(section.getElement().textContent).toContain(`Properties: ${door.name}`);
    while (commandStack.getUndoCount() > undoCountBefore) {
      commandStack.undo();
    }
    expect(GameEntityOwner.isOwner(door)).toBe(true);
  });

  it('lists the tabs on one compact row', () => {
    const { section } = sectionRigCreate();
    expect(section.tabIdsRead()).toEqual(['class_info', 'outputs', 'inputs', 'properties', 'visgroup']);
    expect(section.getElement().querySelector('.tab-book-variant-compact')).not.toBeNull();
  });

  it('lists the Modifiers tab and hides Outputs and Inputs for a modifier volume', () => {
    const { section, selectionManager, worldObject } = sectionRigCreate();
    const volume = ModifierVolume.create({});
    worldObject.add(volume);
    selectionManager.setSelection([], [volume]);
    expect(section.tabIdsRead()).toEqual(['class_info', 'properties', 'modifiers', 'visgroup']);
  });

  it('keeps the stack section out of the Properties tab for a modifier volume', () => {
    const { section, selectionManager, worldObject } = sectionRigCreate();
    const volume = ModifierVolume.create({});
    worldObject.add(volume);
    selectionManager.setSelection([], [volume]);
    section.tabShow('properties');
    const root = section.getElement();
    expect(root.querySelector<HTMLElement>('[data-object-properties-tab="properties"]')?.textContent).not.toContain(
      'Add Modifier',
    );
    section.tabShow('modifiers');
    expect(root.querySelector<HTMLElement>('[data-object-properties-tab="modifiers"]')?.textContent).toContain(
      'Add Modifier',
    );
  });

  it('points the edited object at an object picked by selecting it', () => {
    const { section, selectionManager, worldObject, door } = sectionRigCreate();
    const target = new THREE.Group();
    target.position.set(door.position.x, door.position.y, door.position.z + 3);
    worldObject.add(target);
    sectionActionClick(section, 'point-at');
    selectionManager.setSelection([], [target]);
    expect(selectionManager.getInspectorObjects()).toEqual([door]);
    expect(section.editedObjectsRead()).toEqual([door]);
    expect(objectPropertiesTestForwardRead(door).distanceTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(1e-6);
  });

  it('writes comments onto the selection as one undo step and stops following the selection on dispose', () => {
    const { section, commandStack, selectionManager, door } = sectionRigCreate();
    const undoCountBefore = commandStack.getUndoCount();
    expect(section.commentsWrite('Hall note')).toBe(true);
    expect(section.commentsWrite('Hall note')).toBe(false);
    expect(GameEntityLogicStore.commentsRead(door)).toBe('Hall note');
    expect(commandStack.getUndoCount()).toBe(undoCountBefore + 1);
    section.dispose();
    sectionTestRig = null;
    selectionManager.clearSelection();
    expect(section.editedObjectsRead()).toEqual([door]);
  });
});
