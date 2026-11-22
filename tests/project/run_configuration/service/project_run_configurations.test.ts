import { describe, expect, it } from 'vitest';
import { ConsoleLog } from '@/info_panel/console/console_log.js';
import { MemorySettingsStorage } from '@/settings/storage/settings_storage.js';
import type { RunConfiguration } from '@/project/run_configuration/model/run_configuration_types.js';
import { ProjectRunConfigurations } from '@/project/run_configuration/service/project_run_configurations.js';
import { RunConfigurationActiveStore } from '@/project/run_configuration/service/run_configuration_active_store.js';
import { RunConfigurationRunContextWorkbench } from '@/project/run_configuration/run/run_configuration_run_context_workbench.js';
import { workbenchRigCreate } from '../../workbench/project_workbench_rig.js';

/** Configurations the tests store. */
const SERVICE_TEST_CONFIGURATIONS: RunConfiguration[] = [
  { id: 'play', name: 'Play', steps: [{ kind: 'game_play', enabled: true, fields: {} }] },
  {
    id: 'bake',
    name: 'Bake Lighting',
    steps: [{ kind: 'command', enabled: true, fields: { program: 'cargo', arguments: ['run'] } }],
  },
];

/**
 * Creates run configurations over a workbench rig with a project open.
 *
 * @param storage Storage of the active pick, shared to test remembering.
 * @returns Rig, service and console.
 */
async function serviceRigCreate(storage: MemorySettingsStorage = new MemorySettingsStorage()) {
  const rig = workbenchRigCreate();
  await rig.workbench.projectOpen('/games/service/broom.project.json');
  const consoleLog = new ConsoleLog();
  const service = new ProjectRunConfigurations({
    workbench: rig.workbench,
    activeStore: new RunConfigurationActiveStore(storage),
    context: new RunConfigurationRunContextWorkbench(rig.workbench, 0),
    consoleResolve: () => consoleLog,
  });
  return { ...rig, service, consoleLog, storage };
}

/**
 * The run configurations of a project fall back to a default Play, store edits
 * in the project file, remember the active pick on this computer, and run the
 * picked configuration with its outcome in the console.
 */
describe('ProjectRunConfigurations', () => {
  it('offers the default Play while the project stores no configurations', async () => {
    const { service } = await serviceRigCreate();
    expect(service.isStoredInProject()).toBe(false);
    expect(service.listRead().map((configuration) => configuration.name)).toEqual(['Play']);
    expect(service.activeRead()?.name).toBe('Play');
  });

  it('stores configurations and remembers the active one across instances', async () => {
    const { service, control, storage } = await serviceRigCreate();
    expect((await service.listWrite(SERVICE_TEST_CONFIGURATIONS)).ok).toBe(true);
    expect(control.writtenRunConfigurations).toEqual([SERVICE_TEST_CONFIGURATIONS]);
    service.activeWrite('bake');
    const reopened = await serviceRigCreate(storage);
    await reopened.service.listWrite(SERVICE_TEST_CONFIGURATIONS);
    expect(reopened.service.activeRead()?.id).toBe('bake');
  });

  it('runs the active configuration and reports success in the console', async () => {
    const { service, control, consoleLog } = await serviceRigCreate();
    await service.listWrite(SERVICE_TEST_CONFIGURATIONS);
    service.activeWrite('bake');
    const state = await service.runActive();
    expect(state.phase).toBe('succeeded');
    expect(control.commands.map((entry) => entry.command.program)).toEqual(['cargo']);
    expect(consoleLog.entriesRead().some((entry) => entry.text.includes('Bake Lighting finished'))).toBe(true);
  });

  it('fails a run of a configuration the project does not have', async () => {
    const { service, consoleLog } = await serviceRigCreate();
    const state = await service.run('missing');
    expect(state.phase).toBe('failed');
    expect(consoleLog.entriesRead().some((entry) => entry.text.includes('missing'))).toBe(true);
  });
});
