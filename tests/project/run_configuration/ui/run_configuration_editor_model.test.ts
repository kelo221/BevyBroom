import { describe, expect, it } from 'vitest';
import type { RunConfiguration } from '@/project/run_configuration/model/run_configuration_types.js';
import { RunConfigurationEditorModel } from '@/project/run_configuration/ui/run_configuration_editor_model.js';
import { RUN_CONFIGURATION_STEP_KIND_COMMAND } from '@/project/run_configuration/steps/kinds/run_configuration_step_kind_command.js';
import { RUN_CONFIGURATION_STEP_KIND_LEVEL_SAVE } from '@/project/run_configuration/steps/kinds/run_configuration_step_kind_level_save.js';

/** Configuration the model starts with. */
const EDITOR_TEST_CONFIGURATION: RunConfiguration = {
  id: 'play',
  name: 'Play',
  steps: [{ kind: 'game_play', enabled: true, fields: {} }],
};

/**
 * The editor model edits a copy: adding, copying, removing and renaming
 * configurations, adding, moving, skipping and filling steps, and picking the
 * configuration F9 runs.
 */
describe('RunConfigurationEditorModel', () => {
  it('edits a copy and leaves the configurations it was given alone', () => {
    const model = new RunConfigurationEditorModel([EDITOR_TEST_CONFIGURATION], 'play');
    model.configurationRename('Play Store');
    model.stepAdd(RUN_CONFIGURATION_STEP_KIND_LEVEL_SAVE);
    expect(EDITOR_TEST_CONFIGURATION.name).toBe('Play');
    expect(EDITOR_TEST_CONFIGURATION.steps).toHaveLength(1);
    expect(model.selectedConfigurationRead()?.name).toBe('Play Store');
  });

  it('adds and copies configurations with unique ids and removes them', () => {
    const model = new RunConfigurationEditorModel([EDITOR_TEST_CONFIGURATION], 'play');
    model.configurationAdd();
    model.configurationAdd();
    model.configurationDuplicate();
    const ids = model.configurationsRead().map((configuration) => configuration.id);
    expect(new Set(ids).size).toBe(ids.length);
    model.configurationRemove();
    expect(model.configurationsRead()).toHaveLength(ids.length - 1);
  });

  it('adds a command step with default fields after the selected step and fills it', () => {
    const model = new RunConfigurationEditorModel([EDITOR_TEST_CONFIGURATION], 'play');
    model.stepAdd(RUN_CONFIGURATION_STEP_KIND_COMMAND);
    model.stepFieldWrite('program', 'cargo');
    model.stepFieldWrite('arguments', ['run', '--bake-level', '{level_id}']);
    const steps = model.selectedConfigurationRead()?.steps ?? [];
    expect(steps.map((step) => step.kind)).toEqual(['game_play', RUN_CONFIGURATION_STEP_KIND_COMMAND]);
    expect(steps[1]?.fields).toEqual({
      program: 'cargo',
      arguments: ['run', '--bake-level', '{level_id}'],
      working_directory: '.',
    });
  });

  it('moves, skips and removes the selected step', () => {
    const model = new RunConfigurationEditorModel([EDITOR_TEST_CONFIGURATION], 'play');
    model.stepAdd(RUN_CONFIGURATION_STEP_KIND_LEVEL_SAVE);
    model.stepMove(-1);
    expect(model.selectedConfigurationRead()?.steps.map((step) => step.kind)).toEqual([
      RUN_CONFIGURATION_STEP_KIND_LEVEL_SAVE,
      'game_play',
    ]);
    model.stepEnabledToggle();
    expect(model.selectedStepRead()?.enabled).toBe(false);
    model.stepRemove();
    expect(model.selectedConfigurationRead()?.steps.map((step) => step.kind)).toEqual(['game_play']);
  });

  it('picks the active configuration and falls back to the first when it is removed', () => {
    const model = new RunConfigurationEditorModel([EDITOR_TEST_CONFIGURATION], 'play');
    model.configurationAdd();
    model.configurationActivate();
    const addedId = model.selectedConfigurationRead()?.id;
    expect(model.activeIdRead()).toBe(addedId);
    model.configurationRemove();
    expect(model.activeIdRead()).toBe('play');
  });
});
