import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  RUN_CONFIGURATION_NO_PROJECT_LEVEL_REFUSAL,
  RunConfigurationRunContextWorkbench,
} from '@/project/run_configuration/run/run_configuration_run_context_workbench.js';
import type { ProjectLevelOpen } from '@/project/level/project_level_open.js';
import { workbenchRigCreate } from '../../workbench/project_workbench_rig.js';

/** Project file the rig opens. */
const CONTEXT_TEST_PROJECT_FILE = '/games/context/broom.project.json';

/**
 * Creates a workbench rig with a project open and, optionally, one of its
 * levels open in the editor.
 *
 * @param isLevelOpen True to open a project level.
 * @returns Rig with a context that does not wait between status reads.
 */
async function contextRigCreate(isLevelOpen: boolean) {
  const level: ProjectLevelOpen = {
    projectFile: CONTEXT_TEST_PROJECT_FILE,
    id: 'store',
    name: 'Store',
    document: 'store.json',
    knownModifiedMilliseconds: null,
  };
  const saves: string[] = [];
  const rig = workbenchRigCreate(
    new THREE.Group(),
    () => (isLevelOpen ? level : null),
    async () => {
      saves.push(level.id);
      return null;
    },
  );
  await rig.workbench.projectOpen(CONTEXT_TEST_PROJECT_FILE);
  return { ...rig, level, saves, context: new RunConfigurationRunContextWorkbench(rig.workbench, 0) };
}

/**
 * The workbench context does what steps ask for through the workbench: saves,
 * builds the open project level, runs commands with that level and waits for
 * their end, and starts or stops the game.
 */
describe('RunConfigurationRunContextWorkbench', () => {
  it('runs a command with the open project level and succeeds on exit code 0', async () => {
    const rig = await contextRigCreate(true);
    const command = { program: 'cargo', arguments: ['{level_id}'], working_directory: '.' };
    expect(await rig.context.commandRun(command)).toBeNull();
    expect(rig.control.commands).toEqual([
      { command, level: { levelId: rig.level.id, levelDocument: rig.level.document } },
    ]);
  });

  it('fails a command that exits with another code or is refused', async () => {
    const rig = await contextRigCreate(false);
    rig.control.commandExitCodes.push(2);
    expect(await rig.context.commandRun({ program: 'bake', arguments: [], working_directory: '.' })).not.toBeNull();
    rig.control.commandRefusal = 'No level is open.';
    expect(await rig.context.commandRun({ program: 'bake', arguments: [], working_directory: '.' })).toBe(
      'No level is open.',
    );
  });

  it('saves the open level and builds its package', async () => {
    const rig = await contextRigCreate(true);
    expect(await rig.context.levelSave()).toBeNull();
    expect(rig.saves).toEqual([rig.level.id]);
    expect(await rig.context.levelPackageBuild()).toBeNull();
    expect(rig.control.publishedLevels.map((request) => request.levelName)).toEqual([rig.level.id]);
  });

  it('refuses to build a level package when no project level is open', async () => {
    const rig = await contextRigCreate(false);
    expect(await rig.context.levelPackageBuild()).toBe(RUN_CONFIGURATION_NO_PROJECT_LEVEL_REFUSAL);
  });

  it('starts the game and reports a game that is not running afterwards', async () => {
    const rig = await contextRigCreate(false);
    expect(await rig.context.gamePlay()).not.toBeNull();
    expect(rig.control.actions).toEqual(['launch']);
    expect(await rig.context.gameStop()).toBeNull();
    expect(rig.control.actions).toEqual(['launch', 'stop']);
  });
});
