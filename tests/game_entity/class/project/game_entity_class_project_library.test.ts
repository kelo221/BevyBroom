import { afterEach, describe, expect, it } from 'vitest';
import { GameEntityClassProvider } from '@/game_entity/class/game_entity_class_provider.js';
import { GameEntityClassProviderProject } from '@/game_entity/class/game_entity_class_provider_project.js';
import { GameEntityClassProviderScene } from '@/game_entity/class/game_entity_class_provider_scene.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import {
  type GameEntityClass,
  gameEntityClassFromUnknown,
  gameEntityClassListEmpty,
} from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityClassProjectLibrary } from '@/game_entity/class/project/game_entity_class_project_library.js';
import { workbenchRigCreate } from '../../../project/workbench/project_workbench_rig.js';

/** Name of the class file the fake project names. */
const CLASS_FILE_NAME = 'entity_classes.json';

/**
 * Builds a valid class from a type path and label.
 *
 * @param typePath Component type path.
 * @param label Display label.
 * @returns Class.
 */
function classCreate(typePath: string, label: string): GameEntityClass {
  const gameClass = gameEntityClassFromUnknown({ type_path: typePath, label, category: 'Store', placement: 'point' });
  if (gameClass === null) {
    throw new Error('the test class is valid');
  }
  return gameClass;
}

/**
 * Creates a workbench rig whose project names a class file, and a library over
 * a provider of its own.
 *
 * @param fileText Text of the class file, or null when the file does not exist.
 * @returns The parts.
 */
function libraryRigCreate(fileText: string | null) {
  const rig = workbenchRigCreate();
  const files = new Map<string, string>(fileText === null ? [] : [[CLASS_FILE_NAME, fileText]]);
  rig.control.projectDataFiles.set('entity_classes', files);
  rig.control.projectDataFixedFileNames.set('entity_classes', CLASS_FILE_NAME);
  const provider = new GameEntityClassProvider('project_test');
  const focusTarget = new EventTarget();
  const library = new GameEntityClassProjectLibrary({
    workbench: rig.workbench,
    control: rig.control,
    provider,
    focusTarget,
  });
  return { rig, files, provider, focusTarget, library };
}

/**
 * Serializes classes the way a class file holds them.
 *
 * @param classes Classes.
 * @returns File text.
 */
function classFileTextCreate(classes: GameEntityClass[]): string {
  return JSON.stringify({ classes });
}

/**
 * The classes a project declares in its class file are shared by every level,
 * without the game running.
 */
describe('GameEntityClassProjectLibrary', () => {
  afterEach(() => {
    GameEntityClassProviderProject.shared.listWrite(gameEntityClassListEmpty());
    GameEntityClassProviderScene.shared.listWrite(gameEntityClassListEmpty());
  });

  it('shows the classes of the class file once a project opens and keeps them for every level', async () => {
    const shelf = classCreate('game::Shelf', 'Shelf');
    const { rig, provider, library } = libraryRigCreate(classFileTextCreate([shelf]));
    expect(provider.listRead().classes).toEqual([]);
    await rig.workbench.projectOpen('/games/store/broom.project.json');
    await library.idle();
    expect(provider.listRead().classes.map((entry) => entry.type_path)).toEqual([shelf.type_path]);
    expect(library.fileStateRead()).toEqual({ isConfigured: true, fileName: CLASS_FILE_NAME, problem: null });
    library.dispose();
    expect(provider.listRead().classes).toEqual([]);
  });

  it('reads the class file again when the window gains focus', async () => {
    const { rig, files, provider, focusTarget, library } = libraryRigCreate(classFileTextCreate([]));
    await rig.workbench.projectOpen('/games/store/broom.project.json');
    await library.idle();
    const start = classCreate('game::PlayerStart', 'Player start');
    files.set(CLASS_FILE_NAME, classFileTextCreate([start]));
    focusTarget.dispatchEvent(new Event('focus'));
    await library.idle();
    expect(provider.listRead().classes.map((entry) => entry.label)).toEqual(['Player start']);
  });

  it('writes upserted and removed classes into the class file', async () => {
    const { rig, files, provider, library } = libraryRigCreate(null);
    await rig.workbench.projectOpen('/games/store/broom.project.json');
    await library.idle();
    const shelf = classCreate('game::Shelf', 'Shelf');
    expect(await library.classUpsert(shelf)).toBeNull();
    expect(await library.classUpsert({ ...shelf, label: 'Tall shelf' })).toBeNull();
    const writtenAfterUpsert = JSON.parse(files.get(CLASS_FILE_NAME) ?? '{}') as { classes: GameEntityClass[] };
    expect(writtenAfterUpsert.classes.map((entry) => entry.label)).toEqual(['Tall shelf']);
    expect(await library.classRemove(shelf.type_path)).toBeNull();
    expect(provider.listRead().classes).toEqual([]);
    expect(await library.classRemove(shelf.type_path)).toContain(shelf.type_path);
  });

  it('adopts only the classes the file does not declare yet', async () => {
    const shelf = classCreate('game::Shelf', 'Shelf from file');
    const { rig, provider, library } = libraryRigCreate(classFileTextCreate([shelf]));
    await rig.workbench.projectOpen('/games/store/broom.project.json');
    await library.idle();
    const finish = classCreate('game::FinishZone', 'Finish zone');
    const result = await library.classesAdopt([{ ...shelf, label: 'Shelf from level' }, finish]);
    expect(result).toEqual({ adopted: [finish.type_path] });
    expect(provider.listRead().classes.map((entry) => entry.label)).toEqual(['Shelf from file', 'Finish zone']);
  });

  it('keeps the shown classes and reports a class file that is not JSON', async () => {
    const shelf = classCreate('game::Shelf', 'Shelf');
    const { rig, files, provider, focusTarget, library } = libraryRigCreate(classFileTextCreate([shelf]));
    await rig.workbench.projectOpen('/games/store/broom.project.json');
    await library.idle();
    files.set(CLASS_FILE_NAME, '{ "classes": [');
    focusTarget.dispatchEvent(new Event('focus'));
    await library.idle();
    expect(provider.listRead().classes.map((entry) => entry.type_path)).toEqual([shelf.type_path]);
    expect(library.fileStateRead().problem).toContain(CLASS_FILE_NAME);
  });

  it('refuses writes when the project names no class file', async () => {
    const rig = workbenchRigCreate();
    const provider = new GameEntityClassProvider('project_test');
    const library = new GameEntityClassProjectLibrary({
      workbench: rig.workbench,
      control: rig.control,
      provider,
      focusTarget: null,
    });
    await rig.workbench.projectOpen('/games/plain/broom.project.json');
    await library.idle();
    expect(library.fileStateRead().isConfigured).toBe(false);
    expect(await library.classUpsert(classCreate('game::Shelf', 'Shelf'))).toContain('entity_classes');
  });

  it('lets project classes win over a level snapshot and lose to the connected game', () => {
    const fromScene = classCreate('game::Shelf', 'Shelf from level');
    const fromProject = classCreate('game::Shelf', 'Shelf from project');
    GameEntityClassProviderScene.shared.listWrite({ ...gameEntityClassListEmpty(), classes: [fromScene] });
    GameEntityClassProviderProject.shared.listWrite({ ...gameEntityClassListEmpty(), classes: [fromProject] });
    expect(GameEntityClassRegistry.classFind('game::Shelf')?.label).toBe('Shelf from project');
  });
});
