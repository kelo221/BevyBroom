import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { CommandObjectRename } from '@/outliner/commands/command_object_rename.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { DialogObjectProperties } from '@/ui/object_properties/dialog_object_properties.js';
import { TEST_DOOR_TYPE_PATH, testClassesInstall } from '../../game_entity/game_entity_test_classes.js';
import {
  objectPropertiesTestFieldType,
  objectPropertiesTestForwardRead,
  objectPropertiesTestQuery,
} from './object_properties_test_support.js';

/** Dialog, scene and services one dialog test works with. */
interface DialogTestRig {
  readonly dialog: DialogObjectProperties;
  readonly selectionManager: ManagerSelection;
  readonly commandStack: CommandStack;
  readonly worldObject: THREE.Group;
  readonly door: THREE.Group;
  readonly afterWorldMutation: ReturnType<typeof vi.fn>;
  readonly selectionFrame: ReturnType<typeof vi.fn>;
}

/** Rig of the running test, disposed after it. */
let dialogTestRig: DialogTestRig | null = null;

/**
 * Creates a world with a door entity, selects it and builds the dialog with the
 * built-in tabs.
 *
 * @returns Test rig.
 */
function dialogRigCreate(): DialogTestRig {
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
  const dialog = new DialogObjectProperties(document.body, {
    selectionManager,
    commandStack,
    worldObject,
    afterWorldMutation,
    afterTransformCommit: vi.fn(),
    propertiesPanelRead: () => null,
    selectionFrame,
  });
  dialogTestRig = { dialog, selectionManager, commandStack, worldObject, door, afterWorldMutation, selectionFrame };
  return dialogTestRig;
}

/**
 * Edits a component field, the yaw through the compass dial and the comments of
 * the door from the dialog.
 *
 * @param dialog Open dialog.
 */
function doorLiveEdit(dialog: DialogObjectProperties): void {
  const root = dialog.getRootElement();
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
 * Returns whether the door is back in its state from before the dialog.
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
 * Sets the browser window size the dialog keeps itself inside.
 *
 * @param width Window width in pixels.
 * @param height Window height in pixels.
 */
function windowSizeWrite(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

/**
 * Makes an element report a layout rectangle, which the test DOM does not
 * compute; the stub is removed when the test's mocks are restored.
 *
 * @param element Element to stub.
 * @param rectRead Returns the left, top, width and height to report.
 */
function elementRectStub(
  element: HTMLElement,
  rectRead: () => { left: number; top: number; width: number; height: number },
): void {
  vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => {
    const { left, top, width, height } = rectRead();
    return { left, top, width, height, x: left, y: top, right: left + width, bottom: top + height, toJSON: () => ({}) };
  });
}

/**
 * Clicks a dialog action button.
 *
 * @param dialog Dialog.
 * @param action Action name of the button.
 */
function dialogActionClick(dialog: DialogObjectProperties, action: string): void {
  objectPropertiesTestQuery<HTMLButtonElement>(
    dialog.getRootElement(),
    `[data-object-properties-action="${action}"]`,
  ).click();
}

/**
 * The Object Properties dialog shows edits live, keeps them as one undo step on
 * Apply, restores the earlier state without history on Cancel or Escape, keeps
 * Ctrl+Z inside its own edits, follows selection changes, treats class changes
 * like any other edit and opens centered on one compact tab row.
 */
describe('DialogObjectProperties', () => {
  let uninstall: () => void = () => {};

  beforeEach(() => {
    uninstall = testClassesInstall().uninstall;
  });

  afterEach(() => {
    dialogTestRig?.dialog.dispose();
    dialogTestRig = null;
    uninstall();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('does not open without a selection and titles itself after the object', () => {
    const { dialog, selectionManager, door } = dialogRigCreate();
    selectionManager.clearSelection();
    expect(dialog.open()).toBe(false);
    expect(dialog.isOpen()).toBe(false);
    selectionManager.setSelection([], [door]);
    expect(dialog.open()).toBe(true);
    expect(dialog.getRootElement().textContent).toContain(`Object Properties: ${door.name}`);
  });

  it('restores the state and leaves the history untouched on Cancel', () => {
    const { dialog, commandStack, door, afterWorldMutation } = dialogRigCreate();
    const undoCountBefore = commandStack.getUndoCount();
    dialog.open();
    doorLiveEdit(dialog);
    expect(doorHasEdits(door)).toBe(true);
    dialogActionClick(dialog, 'cancel');
    expect(dialog.isOpen()).toBe(false);
    expect(doorIsPristine(door)).toBe(true);
    expect(commandStack.getUndoCount()).toBe(undoCountBefore);
    expect(commandStack.canRedo()).toBe(false);
    expect(afterWorldMutation).toHaveBeenCalled();
  });

  it('keeps every edit as one undo step on Apply', () => {
    const { dialog, commandStack, door } = dialogRigCreate();
    const undoCountBefore = commandStack.getUndoCount();
    dialog.open();
    doorLiveEdit(dialog);
    dialogActionClick(dialog, 'apply');
    expect(dialog.isOpen()).toBe(false);
    expect(doorHasEdits(door)).toBe(true);
    expect(commandStack.getUndoCount()).toBe(undoCountBefore + 1);
    commandStack.undo();
    expect(doorIsPristine(door)).toBe(true);
  });

  it('stops Ctrl+Z at the dialog start and cancels from Escape', () => {
    const { dialog, commandStack, door } = dialogRigCreate();
    commandStack.push(new CommandObjectRename(door, 'door_renamed_before'));
    dialog.open();
    doorLiveEdit(dialog);
    while (commandStack.undo()) {
      expect(dialog.isOpen()).toBe(true);
    }
    expect(door.name).toBe('door_renamed_before');
    expect(doorIsPristine(door)).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dialog.isOpen()).toBe(false);
    expect(commandStack.canUndo()).toBe(true);
    commandStack.undo();
    expect(door.name).toBe('door_main');
  });

  it('keeps a command another part of the editor recorded while open, and the edits before it, on Cancel', () => {
    const { dialog, commandStack, worldObject, door } = dialogRigCreate();
    const outsider = new THREE.Group();
    outsider.name = 'outsider';
    worldObject.add(outsider);
    const undoCountBefore = commandStack.getUndoCount();
    dialog.open();
    doorLiveEdit(dialog);
    commandStack.push(new CommandObjectRename(outsider, 'outsider_renamed'));
    dialogActionClick(dialog, 'cancel');
    expect(outsider.name).toBe('outsider_renamed');
    expect(doorHasEdits(door)).toBe(true);
    expect(commandStack.getUndoCount()).toBe(undoCountBefore + 2);
    commandStack.undo();
    expect(outsider.name).toBe('outsider');
    expect(doorHasEdits(door)).toBe(true);
    commandStack.undo();
    expect(doorIsPristine(door)).toBe(true);
  });

  it('applies the edits as one entry below a command another part of the editor recorded while open', () => {
    const { dialog, commandStack, worldObject, door } = dialogRigCreate();
    const outsider = new THREE.Group();
    worldObject.add(outsider);
    const undoCountBefore = commandStack.getUndoCount();
    dialog.open();
    doorLiveEdit(dialog);
    const foreign = new CommandObjectRename(outsider, 'outsider_renamed');
    commandStack.push(foreign);
    dialogActionClick(dialog, 'apply');
    expect(commandStack.getUndoCount()).toBe(undoCountBefore + 2);
    expect(commandStack.peekUndo()).toBe(foreign);
    commandStack.undo();
    commandStack.undo();
    expect(doorIsPristine(door)).toBe(true);
  });

  it('applies and edits the new selection when the selection changes', () => {
    const { dialog, selectionManager, commandStack, worldObject, door } = dialogRigCreate();
    const undoCountBefore = commandStack.getUndoCount();
    dialog.open();
    doorLiveEdit(dialog);
    const other = GameEntityOwner.createDefault('other');
    other.name = 'other';
    worldObject.add(other);
    selectionManager.setSelection([], [other]);
    expect(dialog.isOpen()).toBe(true);
    expect(dialog.editedObjectsRead()).toEqual([other]);
    expect(doorHasEdits(door)).toBe(true);
    expect(commandStack.getUndoCount()).toBe(undoCountBefore + 1);
    selectionManager.clearSelection();
    expect(dialog.isOpen()).toBe(false);
  });

  it('copies the components of one object and pastes them onto another', () => {
    const { dialog, selectionManager, worldObject, door } = dialogRigCreate();
    GameEntityComponentStore.write(door, { [TEST_DOOR_TYPE_PATH]: { uses: 4 } });
    dialog.open();
    dialogActionClick(dialog, 'copy');
    const other = GameEntityOwner.createDefault('other');
    worldObject.add(other);
    selectionManager.setSelection([], [other]);
    dialogActionClick(dialog, 'paste');
    expect(GameEntityComponentStore.read(other)).toEqual(GameEntityComponentStore.read(door));
  });

  it('keeps output rows added and edited in the Outputs tab as one undo step on Apply', () => {
    const { dialog, commandStack, worldObject, door } = dialogRigCreate();
    const relay = GameEntityOwner.createDefault('relay');
    relay.name = 'relay_target';
    worldObject.add(relay);
    const undoCountBefore = commandStack.getUndoCount();
    dialog.open();
    dialog.tabHostRead().tabBookRead().tabShow('outputs');
    const root = dialog.getRootElement();
    objectPropertiesTestQuery<HTMLButtonElement>(root, '[data-logic-action="add"]').click();
    objectPropertiesTestFieldType(
      objectPropertiesTestQuery(root, 'input[aria-label="Targets entities named"]'),
      relay.name,
    );
    objectPropertiesTestFieldType(objectPropertiesTestQuery(root, 'input[aria-label="Via this input"]'), 'Enable');
    dialogActionClick(dialog, 'apply');
    expect(GameEntityLogicStore.read(door).map((row) => [row.target, row.input])).toEqual([[relay.name, 'Enable']]);
    expect(commandStack.getUndoCount()).toBe(undoCountBefore + 1);
    commandStack.undo();
    expect(GameEntityLogicStore.read(door)).toEqual([]);
  });

  it('retargets the dialog to the source marked in the Inputs tab and frames it on double-click', () => {
    const { dialog, selectionManager, worldObject, door, selectionFrame } = dialogRigCreate();
    const button = GameEntityOwner.createDefault('button');
    button.name = 'button_source';
    GameEntityLogicStore.write(button, [
      { output: 'OnPressed', target: door.name, input: 'Open', parameter: '', delay: 0, times_to_fire: -1 },
    ]);
    worldObject.add(button);
    dialog.open();
    dialog.tabHostRead().tabBookRead().tabShow('inputs');
    const row = objectPropertiesTestQuery<HTMLTableRowElement>(
      dialog.getRootElement(),
      'table[aria-label="Inputs"] tbody tr',
    );
    row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(selectionManager.getInspectorObjects()).toEqual([button]);
    expect(dialog.editedObjectsRead()).toEqual([button]);
    expect(selectionFrame).toHaveBeenCalledTimes(1);
  });

  it('opens centered in its host the first time and stays where it was moved', () => {
    const { dialog } = dialogRigCreate();
    const hostRect = { left: 40, top: 30, width: 1400, height: 900 };
    const panelSize = { width: 680, height: 420 };
    const windowSizeBefore = { width: window.innerWidth, height: window.innerHeight };
    windowSizeWrite(hostRect.left + hostRect.width + 100, hostRect.top + hostRect.height + 100);
    elementRectStub(document.body, () => hostRect);
    const root = dialog.getRootElement();
    elementRectStub(root, () => ({ left: parseFloat(root.style.left), top: parseFloat(root.style.top), ...panelSize }));
    dialog.open();
    expect(parseFloat(root.style.left) + panelSize.width / 2).toBeCloseTo(hostRect.left + hostRect.width / 2, 0);
    expect(parseFloat(root.style.top) + panelSize.height / 2).toBeCloseTo(hostRect.top + hostRect.height / 2, 0);
    const movedLeft = `${parseFloat(root.style.left) + 25}px`;
    root.style.left = movedLeft;
    dialogActionClick(dialog, 'cancel');
    dialog.open();
    expect(root.style.left).toBe(movedLeft);
    windowSizeWrite(windowSizeBefore.width, windowSizeBefore.height);
  });

  it('undoes a class change from the Class combo on Cancel and keeps it as one undo step on Apply', () => {
    const { dialog, commandStack, door } = dialogRigCreate();
    const undoCountBefore = commandStack.getUndoCount();
    dialog.open();
    const classCombo = objectPropertiesTestQuery<HTMLInputElement>(
      dialog.getRootElement(),
      'input[aria-label="Class"]',
    );
    objectPropertiesTestFieldType(classCombo, 'Point Light');
    expect(LightOwner.isOwner(door)).toBe(true);
    expect(classCombo.value).toBe('Point Light');
    expect(dialog.getRootElement().textContent).toContain(`Object Properties: ${door.name}`);
    dialogActionClick(dialog, 'cancel');
    expect(GameEntityOwner.isOwner(door)).toBe(true);
    expect(GameEntityComponentStore.read(door)).toEqual({ [TEST_DOOR_TYPE_PATH]: {} });
    expect(commandStack.getUndoCount()).toBe(undoCountBefore);
    dialog.open();
    objectPropertiesTestFieldType(
      objectPropertiesTestQuery<HTMLInputElement>(dialog.getRootElement(), 'input[aria-label="Class"]'),
      'Point Light',
    );
    dialogActionClick(dialog, 'apply');
    expect(LightOwner.isOwner(door)).toBe(true);
    expect(commandStack.getUndoCount()).toBe(undoCountBefore + 1);
    commandStack.undo();
    expect(GameEntityOwner.isOwner(door)).toBe(true);
  });

  it('lists the tabs on one compact row', () => {
    const { dialog } = dialogRigCreate();
    dialog.open();
    expect(dialog.tabIdsRead()).toEqual(['class_info', 'outputs', 'inputs', 'properties', 'visgroup']);
    expect(dialog.getRootElement().querySelector('.tab-book-variant-compact')).not.toBeNull();
  });

  it('points the edited object at an object picked by selecting it', () => {
    const { dialog, selectionManager, worldObject, door } = dialogRigCreate();
    const target = new THREE.Group();
    target.position.set(door.position.x, door.position.y, door.position.z + 3);
    worldObject.add(target);
    dialog.open();
    dialogActionClick(dialog, 'point-at');
    selectionManager.setSelection([], [target]);
    expect(selectionManager.getInspectorObjects()).toEqual([door]);
    expect(dialog.editedObjectsRead()).toEqual([door]);
    expect(objectPropertiesTestForwardRead(door).distanceTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(1e-6);
  });
});
