import { afterEach, describe, expect, it } from 'vitest';
import { EditorApi } from '@/ai/client/editor_api.js';
import { findMcpTool } from '@/ai/server/registry_mcp_tool.js';
import { GameEntityClassProviderProject } from '@/game_entity/class/game_entity_class_provider_project.js';
import { GameEntityClassProviderScene } from '@/game_entity/class/game_entity_class_provider_scene.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { gameEntityClassListEmpty, gameEntityClassFromUnknown } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityClassProjectLibrary } from '@/game_entity/class/project/game_entity_class_project_library.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';
import { workbenchRigCreate } from '../../project/workbench/project_workbench_rig.js';

/** Class file name of the fake project. */
const CLASS_FILE_NAME = 'entity_classes.json';

/** Data of a list_project_classes result. */
interface ProjectClassListData {
  isConfigured: boolean;
  classes: { type_path: string; label: string }[];
  undeclaredLevelClasses: string[];
}

/**
 * Opens a fake project with an empty class file and an editor API.
 *
 * @returns API, the fake project files and the library.
 */
async function classApiCreate() {
  const rig = workbenchRigCreate();
  const files = new Map<string, string>();
  rig.control.projectDataFiles.set('entity_classes', files);
  rig.control.projectDataFixedFileNames.set('entity_classes', CLASS_FILE_NAME);
  const library = new GameEntityClassProjectLibrary({
    workbench: rig.workbench,
    control: rig.control,
    provider: GameEntityClassProviderProject.shared,
    focusTarget: null,
  });
  await rig.workbench.projectOpen('/games/store/broom.project.json');
  await library.idle();
  return { api: new EditorApi(editorApiTestHostCreate().host), files, library };
}

/** Unit tests for the project class MCP tools. */
describe('EditorApi project class tools', () => {
  afterEach(() => {
    GameEntityClassProjectLibrary.activeRead()?.dispose();
    GameEntityClassProviderScene.shared.listWrite(gameEntityClassListEmpty());
  });

  it('lists every project class tool in the MCP catalog', () => {
    ['list_project_classes', 'set_project_class', 'remove_project_class', 'move_level_classes_to_project'].forEach(
      (name) => expect(findMcpTool(name)).toBeDefined(),
    );
  });

  it('declares a class that every level sees, then removes it', async () => {
    const { api, files } = await classApiCreate();
    const declared = await api.invokeToolAsync('set_project_class', {
      class: { type_path: 'store::Shelf', label: 'Shelf', placement: 'point' },
    });
    expect(declared.ok).toBe(true);
    expect(GameEntityClassRegistry.classFind('store::Shelf')?.label).toBe('Shelf');
    expect(files.get(CLASS_FILE_NAME)).toContain('store::Shelf');
    const listed = (await api.invokeToolAsync('list_project_classes')).data as ProjectClassListData;
    expect(listed.isConfigured).toBe(true);
    expect(listed.classes.map((entry) => entry.type_path)).toEqual(['store::Shelf']);
    expect((await api.invokeToolAsync('remove_project_class', { typePath: 'store::Shelf' })).ok).toBe(true);
    expect(GameEntityClassRegistry.classFind('store::Shelf')).toBeNull();
  });

  it('moves the classes of the open level into the class file', async () => {
    const { api } = await classApiCreate();
    const levelClass = gameEntityClassFromUnknown({ type_path: 'store::FinishZone' });
    if (levelClass === null) throw new Error('the level class is valid');
    GameEntityClassProviderScene.shared.listWrite({ ...gameEntityClassListEmpty(), classes: [levelClass] });
    const before = (await api.invokeToolAsync('list_project_classes')).data as ProjectClassListData;
    expect(before.undeclaredLevelClasses).toEqual(['store::FinishZone']);
    const moved = await api.invokeToolAsync('move_level_classes_to_project');
    expect(moved.data).toEqual({ moved: ['store::FinishZone'] });
    const after = (await api.invokeToolAsync('list_project_classes')).data as ProjectClassListData;
    expect(after.classes.map((entry) => entry.type_path)).toEqual(['store::FinishZone']);
  });

  it('refuses a class without a type path', async () => {
    const { api } = await classApiCreate();
    expect((await api.invokeToolAsync('set_project_class', { class: { label: 'Nameless' } })).ok).toBe(false);
  });
});
