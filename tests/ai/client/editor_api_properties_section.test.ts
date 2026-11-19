import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorApi } from '@/ai/client/editor_api.js';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import { SectionObjectProperties } from '@/ui/object_properties/section/section_object_properties.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';
import { logicTestSceneCreate } from '../../game_entity/logic/game_entity_logic_test_support.js';

/** Sections created by the running test, disposed after it. */
const sectionsCreated: SectionObjectProperties[] = [];

/**
 * Builds an EditorApi whose host owns a Properties section over a world holding
 * a button and a door, with the button selected.
 *
 * @returns API, scene and command stack.
 */
function sectionToolsRigCreate() {
  const scene = logicTestSceneCreate(1);
  let section: SectionObjectProperties | null = null;
  const parts = editorApiTestHostCreate({ objectPropertiesSectionRead: () => sectionEnsure() });
  const sectionEnsure = (): SectionObjectProperties => {
    if (!section) {
      section = new SectionObjectProperties({
        selectionManager: parts.host.selectionManager,
        commandStack: parts.commandStack,
        worldObject: parts.world,
        afterWorldMutation: vi.fn(),
        afterTransformCommit: vi.fn(),
        propertiesPanelRead: () => null,
        selectionFrame: vi.fn(),
        dockReveal: vi.fn(),
      });
      document.body.appendChild(section.getElement());
      sectionsCreated.push(section);
    }
    return section;
  };
  parts.world.add(scene.button, ...scene.doors);
  parts.host.selectionManager.setSelection([], [scene.button]);
  return { ...parts, scene, api: new EditorApi(parts.host) };
}

/** State the Properties section tools report. */
interface PropertiesSectionTestState {
  tab: string;
  tabs: string[];
  editedIds: string[];
}

/**
 * The Properties section tools report the selected objects and tabs, switch the
 * tab, and write comments as one undo step.
 */
describe('EditorApiPropertiesSection', () => {
  afterEach(() => {
    sectionsCreated.splice(0).forEach((section) => section.dispose());
    document.body.replaceChildren();
  });

  it('shows the selection, switches to the Outputs tab and reports the state', () => {
    const rig = sectionToolsRigCreate();
    expect(rig.api.invokeTool('set_properties_section', { tab: 'outputs' }).ok).toBe(true);
    const state = rig.api.invokeTool('get_properties_section').data as PropertiesSectionTestState;
    expect(state.tab).toBe('outputs');
    expect(state.tabs).toEqual(expect.arrayContaining(['class_info', 'outputs', 'inputs']));
    expect(state.editedIds).toEqual([rig.scene.button.uuid]);
  });

  it('writes comments as one undo step and refuses them without a selection', () => {
    const rig = sectionToolsRigCreate();
    const undoCountBefore = rig.commandStack.getUndoCount();
    const written = rig.api.invokeTool('set_properties_section', { comments: 'Hall note' });
    expect(written.message).toBe('Properties comments written');
    expect(GameEntityLogicStore.commentsRead(rig.scene.button)).toBe('Hall note');
    expect(rig.commandStack.getUndoCount()).toBe(undoCountBefore + 1);
    rig.commandStack.undo();
    expect(GameEntityLogicStore.commentsRead(rig.scene.button)).toBe('');
    rig.host.selectionManager.clearSelection();
    expect(rig.api.invokeTool('set_properties_section', { comments: 'note' }).ok).toBe(false);
  });

  it('refuses unknown tabs and non-text comments', () => {
    const rig = sectionToolsRigCreate();
    expect(rig.api.invokeTool('set_properties_section', { tab: 'no_such_tab' }).ok).toBe(false);
    expect(rig.api.invokeTool('set_properties_section', { comments: 7 }).ok).toBe(false);
  });

  it('fails when the editor has no Properties section', () => {
    const api = new EditorApi(editorApiTestHostCreate().host);
    expect(api.invokeTool('get_properties_section').ok).toBe(false);
  });
});
