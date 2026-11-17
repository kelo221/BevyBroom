import { describe, expect, it } from 'vitest';
import { ConsoleLog } from '@/info_panel/console/console_log.js';
import { GameEntityClassProvider } from '@/game_entity/class/game_entity_class_provider.js';
import {
  type GameEntityClass,
  gameEntityClassFromUnknown,
  gameEntityClassListEmpty,
} from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityClassProjectLibrary } from '@/game_entity/class/project/game_entity_class_project_library.js';
import {
  GAME_ENTITY_CLASS_PROJECT_MOVE_MENU_LABEL,
  GameEntityClassProjectLevelClasses,
} from '@/game_entity/class/project/game_entity_class_project_level_classes.js';
import { workbenchRigCreate } from '../../../project/workbench/project_workbench_rig.js';

/** Name of the class file the fake project names. */
const CLASS_FILE_NAME = 'classes.json';

/**
 * Builds a valid class.
 *
 * @param typePath Component type path.
 * @returns Class.
 */
function classCreate(typePath: string): GameEntityClass {
  const gameClass = gameEntityClassFromUnknown({ type_path: typePath });
  if (gameClass === null) {
    throw new Error('the test class is valid');
  }
  return gameClass;
}

/**
 * Creates an opened project with a class file declaring some classes, a level
 * snapshot provider and the helper over both.
 *
 * @param declared Type paths the class file declares.
 * @returns The parts.
 */
async function levelClassesRigCreate(declared: string[]) {
  const rig = workbenchRigCreate();
  const fileText = JSON.stringify({ classes: declared.map(classCreate) });
  rig.control.projectDataFiles.set('entity_classes', new Map([[CLASS_FILE_NAME, fileText]]));
  rig.control.projectDataFixedFileNames.set('entity_classes', CLASS_FILE_NAME);
  const projectProvider = new GameEntityClassProvider('project_test');
  const library = new GameEntityClassProjectLibrary({
    workbench: rig.workbench,
    control: rig.control,
    provider: projectProvider,
    focusTarget: null,
  });
  await rig.workbench.projectOpen('/games/store/broom.project.json');
  await library.idle();
  const sceneProvider = new GameEntityClassProvider('scene_test');
  const consoleLog = new ConsoleLog();
  const levelClasses = new GameEntityClassProjectLevelClasses(library, sceneProvider, () => consoleLog);
  return { rig, projectProvider, sceneProvider, consoleLog, levelClasses, library };
}

/** A level's own class snapshot can be moved into the project's class file. */
describe('GameEntityClassProjectLevelClasses', () => {
  it('names the level classes the project does not declare and moves them into the file', async () => {
    const { rig, sceneProvider, consoleLog, levelClasses } = await levelClassesRigCreate(['game::Shelf']);
    const levelClassList = [classCreate('game::Shelf'), classCreate('game::FinishZone')];
    sceneProvider.listWrite({ ...gameEntityClassListEmpty(), classes: levelClassList });
    expect(levelClasses.undeclaredTypePathsRead()).toEqual(['game::FinishZone']);
    await levelClasses.levelClassesMove();
    const written = JSON.parse(rig.control.projectDataFiles.get('entity_classes')?.get(CLASS_FILE_NAME) ?? '{}');
    expect(written.classes.map((entry: GameEntityClass) => entry.type_path)).toEqual([
      'game::Shelf',
      'game::FinishZone',
    ]);
    expect(levelClasses.undeclaredTypePathsRead()).toEqual([]);
    expect(consoleLog.entriesRead().at(-1)?.text).toContain('game::FinishZone');
  });

  it('warns once per distinct set of undeclared classes, naming the menu row', async () => {
    const { projectProvider, sceneProvider, consoleLog, levelClasses } = await levelClassesRigCreate([]);
    levelClasses.noticeFollow(projectProvider);
    const levelClassList = [classCreate('game::PlayerStart')];
    sceneProvider.listWrite({ ...gameEntityClassListEmpty(), classes: levelClassList });
    sceneProvider.listWrite({ ...gameEntityClassListEmpty(), classes: levelClassList });
    const warnings = consoleLog.entriesRead().filter((entry) => entry.level === 'warning');
    expect(warnings.length).toBe(1);
    expect(warnings[0]?.text).toContain(GAME_ENTITY_CLASS_PROJECT_MOVE_MENU_LABEL);
  });
});
