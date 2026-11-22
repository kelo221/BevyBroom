import { afterEach, describe, expect, it } from 'vitest';
import type { RunConfiguration } from '@/project/run_configuration/model/run_configuration_types.js';
import {
  type DialogRunConfigurationsAnswer,
  showRunConfigurationsDialog,
} from '@/project/run_configuration/ui/dialog_run_configurations.js';
import { RUN_CONFIGURATION_STEP_KIND_COMMAND } from '@/project/run_configuration/steps/kinds/run_configuration_step_kind_command.js';

/** Configuration the dialog opens with. */
const DIALOG_TEST_CONFIGURATION: RunConfiguration = {
  id: 'play',
  name: 'Play',
  steps: [{ kind: 'game_play', enabled: true, fields: {} }],
};

/**
 * Finds a control by its accessible name.
 *
 * @param label Accessible name.
 * @returns The element.
 */
function controlFind<T extends HTMLElement>(label: string): T {
  const element = document.querySelector<T>(`[aria-label="${label}"]`);
  if (element === null) throw new Error(`missing control ${label}`);
  return element;
}

/**
 * Clicks the dialog button with a text.
 *
 * @param text Button text.
 */
function buttonClick(text: string): void {
  const button = Array.from(document.querySelectorAll('button')).find((candidate) => candidate.textContent === text);
  if (!button) throw new Error(`missing button ${text}`);
  button.click();
}

/**
 * Types into a control and commits the change.
 *
 * @param label Accessible name.
 * @param value New value.
 */
function controlChange(label: string, value: string): void {
  const control = controlFind<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(label);
  control.value = value;
  control.dispatchEvent(new Event('change'));
}

/**
 * The Run Configurations dialog edits configurations through its controls and
 * hands back the edited list and active pick on Save, or nothing on Cancel.
 */
describe('Run Configurations dialog', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('builds a bake configuration with a command step and saves it as the active one', async () => {
    const answerPromise = showRunConfigurationsDialog({
      host: document.body,
      configurations: [DIALOG_TEST_CONFIGURATION],
      activeId: 'play',
    });
    buttonClick('New');
    controlChange('Configuration name', 'Bake Lighting');
    controlChange('Add step', RUN_CONFIGURATION_STEP_KIND_COMMAND);
    controlChange('Program', 'cargo');
    controlChange('Arguments (one per line)', 'run\n--bake-level\n{level_export_directory}\n');
    buttonClick('Run on F9');
    buttonClick('Save');
    const answer: DialogRunConfigurationsAnswer | null = await answerPromise;
    const bake = answer?.configurations.find((configuration) => configuration.name === 'Bake Lighting');
    expect(answer?.configurations).toHaveLength(2);
    expect(bake?.steps).toEqual([
      {
        kind: RUN_CONFIGURATION_STEP_KIND_COMMAND,
        enabled: true,
        fields: {
          program: 'cargo',
          arguments: ['run', '--bake-level', '{level_export_directory}'],
          working_directory: '.',
        },
      },
    ]);
    expect(answer?.activeId).toBe(bake?.id);
  });

  it('hands back nothing when cancelled', async () => {
    const answerPromise = showRunConfigurationsDialog({
      host: document.body,
      configurations: [DIALOG_TEST_CONFIGURATION],
      activeId: 'play',
    });
    buttonClick('Remove');
    buttonClick('Cancel');
    expect(await answerPromise).toBeNull();
  });
});
