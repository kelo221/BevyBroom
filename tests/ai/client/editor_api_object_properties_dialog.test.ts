import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorApi } from '@/ai/client/editor_api.js';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import { DialogObjectProperties } from '@/ui/object_properties/dialog_object_properties.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';
import { objectPropertiesTestQuery } from '../../ui/object_properties/object_properties_test_support.js';
import { logicTestSceneCreate } from '../../game_entity/logic/game_entity_logic_test_support.js';

/** Dialogs created by the running test, disposed after it. */
const dialogsCreated: DialogObjectProperties[] = [];

/**
 * Builds an EditorApi whose host owns an Object Properties dialog over a world
 * holding a button and a door, with the button selected.
 *
 * @returns API, dialog, scene and command stack.
 */
function dialogToolsRigCreate() {
  const scene = logicTestSceneCreate(1);
  let dialog: DialogObjectProperties | null = null;
  const parts = editorApiTestHostCreate({ objectPropertiesDialogRead: () => dialogEnsure() });
  const dialogEnsure = (): DialogObjectProperties => {
    if (!dialog) {
      dialog = new DialogObjectProperties(document.body, {
        selectionManager: parts.host.selectionManager,
        commandStack: parts.commandStack,
        worldObject: parts.world,
        afterWorldMutation: vi.fn(),
        afterTransformCommit: vi.fn(),
        propertiesPanelRead: () => null,
        selectionFrame: vi.fn(),
      });
      dialogsCreated.push(dialog);
    }
    return dialog;
  };
  parts.world.add(scene.button, ...scene.doors);
  parts.host.selectionManager.setSelection([], [scene.button]);
  return { ...parts, scene, api: new EditorApi(parts.host) };
}

/**
 * The Object Properties dialog tools open the dialog on the selection, switch
 * its tab, and apply or cancel the edits made while it was open.
 */
describe('EditorApiObjectPropertiesDialog', () => {
  afterEach(() => {
    dialogsCreated.splice(0).forEach((dialog) => dialog.dispose());
    document.body.replaceChildren();
  });

  it('opens on the selection, switches to the Outputs tab and reports the state', () => {
    const rig = dialogToolsRigCreate();
    const opened = rig.api.invokeTool('set_object_properties_dialog', { action: 'open', tab: 'outputs' });
    expect(opened.ok).toBe(true);
    const state = rig.api.invokeTool('get_object_properties_dialog').data as {
      open: boolean;
      tab: string;
      tabs: string[];
      editedIds: string[];
    };
    expect(state.open).toBe(true);
    expect(state.tab).toBe('outputs');
    expect(state.tabs).toEqual(expect.arrayContaining(['class_info', 'outputs', 'inputs']));
    expect(state.editedIds).toEqual([rig.scene.button.uuid]);
  });

  it('closes on apply and on cancel, applying edits made in the dialog as one undo step', () => {
    const rig = dialogToolsRigCreate();
    const undoCountBefore = rig.commandStack.getUndoCount();
    rig.api.invokeTool('set_object_properties_dialog', { action: 'open', tab: 'outputs' });
    const dialog = rig.host.objectPropertiesDialogRead?.();
    objectPropertiesTestQuery<HTMLButtonElement>(document.body, '[data-logic-action="add"]').click();
    const cancelled = rig.api.invokeTool('set_object_properties_dialog', { action: 'cancel' });
    expect((cancelled.data as { open: boolean }).open).toBe(false);
    expect(GameEntityLogicStore.read(rig.scene.button)).toEqual([]);
    rig.api.invokeTool('set_object_properties_dialog', { action: 'open', tab: 'outputs' });
    objectPropertiesTestQuery<HTMLButtonElement>(document.body, '[data-logic-action="add"]').click();
    const applied = rig.api.invokeTool('set_object_properties_dialog', { action: 'apply' });
    expect((applied.data as { open: boolean }).open).toBe(false);
    expect(dialog?.isOpen()).toBe(false);
    expect(GameEntityLogicStore.read(rig.scene.button)).toHaveLength(1);
    expect(rig.commandStack.getUndoCount()).toBe(undoCountBefore + 1);
  });

  it('refuses unknown actions and tabs, and opening without a selection', () => {
    const rig = dialogToolsRigCreate();
    expect(rig.api.invokeTool('set_object_properties_dialog', { action: 'close' }).ok).toBe(false);
    expect(rig.api.invokeTool('set_object_properties_dialog', { tab: 'no_such_tab' }).ok).toBe(false);
    rig.host.selectionManager.clearSelection();
    expect(rig.api.invokeTool('set_object_properties_dialog', { action: 'open' }).ok).toBe(false);
  });

  it('fails when the editor has no dialog', () => {
    const api = new EditorApi(editorApiTestHostCreate().host);
    expect(api.invokeTool('get_object_properties_dialog').ok).toBe(false);
  });
});
