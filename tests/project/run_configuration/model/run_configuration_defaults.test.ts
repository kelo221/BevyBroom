import { describe, expect, it } from 'vitest';
import { runConfigurationDefaultsCreate } from '@/project/run_configuration/model/run_configuration_defaults.js';
import { projectSummaryCreate } from '../../workbench/project_workbench_rig.js';

/**
 * A project without run configurations gets one Play configuration whose steps
 * match what its game reads: the saved level, the built level package, or
 * neither.
 */
describe('runConfigurationDefaultsCreate', () => {
  it('saves and builds the level before starting a game that reads its package', () => {
    const project = {
      ...projectSummaryCreate('/g/a/broom.project.json'),
      isLevelLaunch: true,
      isLevelExportLaunch: true,
    };
    const [play] = runConfigurationDefaultsCreate(project);
    expect(play?.steps.map((step) => step.kind)).toEqual(['level_save', 'level_package_build', 'game_play']);
  });

  it('only starts a game that does not start in a level', () => {
    const [play] = runConfigurationDefaultsCreate(projectSummaryCreate('/g/b/broom.project.json'));
    expect(play?.steps.map((step) => step.kind)).toEqual(['game_play']);
    expect(play?.steps.every((step) => step.enabled)).toBe(true);
  });
});
