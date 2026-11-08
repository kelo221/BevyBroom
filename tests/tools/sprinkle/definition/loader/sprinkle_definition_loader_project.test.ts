import { describe, expect, it } from 'vitest';
import { GameProcessControlUnavailable } from '@/project/control/game_process_control.js';
import { SprinkleDefinitionBuilder } from '@/tools/sprinkle/definition/builder/sprinkle_definition_builder.js';
import { SprinkleDefinitionLoaderProject } from '@/tools/sprinkle/definition/loader/sprinkle_definition_loader_project.js';
import { GameProcessControlFake } from '../../../../project/workbench/project_workbench_rig.js';

/** Project file the fake control has open in these tests. */
const LOADER_TEST_PROJECT_FILE = '/games/loader/broom.project.json';

/**
 * Creates a fake control with a project open and the given definition files.
 *
 * @param files Definition files of the open project.
 * @returns Fake control.
 */
async function controlWithProjectCreate(files: { path: string; text: string }[]): Promise<GameProcessControlFake> {
  const control = new GameProcessControlFake();
  await control.projectOpen(LOADER_TEST_PROJECT_FILE);
  control.projectSprinkleFiles.set(LOADER_TEST_PROJECT_FILE, files);
  return control;
}

/** Builder that knows no game classes. */
const builderWithoutClasses = new SprinkleDefinitionBuilder(() => null);

/** Unit tests for loading sprinkle definitions through the process control. */
describe('SprinkleDefinitionLoaderProject', () => {
  it("builds the open project's definition files and reports their problems", async () => {
    const files = [
      { path: 'sprinkle/a.txt', text: 'Rocks { base { classname rock } 1 { } }' },
      { path: 'sprinkle/b.txt', text: 'Broken {' },
    ];
    const loader = new SprinkleDefinitionLoaderProject(await controlWithProjectCreate(files), builderWithoutClasses);
    const result = await loader.load();
    expect(result.definitions.map((definition) => [definition.name, definition.sourcePath])).toEqual([
      ['Rocks', files[0]?.path],
    ]);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toContain(files[1]?.path);
  });

  it('turns an unreadable project into no definitions and the reason as the problem', async () => {
    const control = new GameProcessControlUnavailable();
    const expected = await control.projectSprinkleDefinitionFilesRead();
    const result = await new SprinkleDefinitionLoaderProject(control, builderWithoutClasses).load();
    expect(result).toEqual({ definitions: [], problems: [expected.ok ? '' : expected.message] });
  });

  it('opens a source through the control and returns why opening failed', async () => {
    const control = await controlWithProjectCreate([]);
    const loader = new SprinkleDefinitionLoaderProject(control, builderWithoutClasses);
    const sourcePath = 'sprinkle/a.txt';
    expect(await loader.sourceOpen(sourcePath)).toBeNull();
    expect(control.openedSprinkleDefinitions).toEqual([sourcePath]);
    const failure = 'the editor is missing';
    control.nextSprinkleOpenResult = { ok: false, message: failure };
    expect(await loader.sourceOpen(sourcePath)).toBe(failure);
  });
});
