import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import { MCP_TOOL_DEFINITIONS } from '@/ai/server/registry_mcp_tool.js';
import { ProjectIssueBoard } from '@/project/issues/project_issue_board.js';
import type { ProjectWorkbench } from '@/project/workbench/project_workbench.js';
import type { RunConfigurationRunState } from '@/project/run_configuration/run/run_configuration_run_state.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';
import { workbenchRigCreate } from '../../project/workbench/project_workbench_rig.js';

/** Workbenches the tests made, disposed after each test. */
const workbenches: ProjectWorkbench[] = [];

/** Configuration the tests store: one command step. */
const MCP_TEST_CONFIGURATION = {
  id: 'bake_lighting',
  name: 'Bake Lighting',
  steps: [{ kind: 'command', program: 'cargo', arguments: ['run', '--bake-level', '{project_directory}'] }],
};

/**
 * Creates an editor API over a workbench rig with a project open.
 *
 * @returns API and rig.
 */
async function runConfigurationApiRigCreate() {
  const world = new THREE.Group();
  const workbenchRig = workbenchRigCreate(world);
  workbenches.push(workbenchRig.workbench);
  const parts = editorApiTestHostCreate({ worldObject: world, projectWorkbenchEnsure: () => workbenchRig.workbench });
  const api = new EditorApi(parts.host);
  await api.invokeToolAsync('project_open', { path: '/games/mcp run/broom.project.json' });
  return { api, workbenchRig };
}

/**
 * Lists the run configurations through the tool until the last run ended.
 *
 * @param api Editor API.
 * @returns Final run state.
 */
async function runStateEndedRead(api: EditorApi): Promise<RunConfigurationRunState | null> {
  for (;;) {
    const listed = await api.invokeToolAsync('list_run_configurations');
    const runState = (listed.data as { runState: RunConfigurationRunState | null }).runState;
    if (runState === null || runState.phase !== 'running') {
      return runState;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/**
 * The run configuration MCP tools list the default and stored configurations,
 * store new ones in the project and run them like the Run menu.
 */
describe('EditorApiProjectRunConfigurations', () => {
  afterEach(() => {
    workbenches.splice(0).forEach((workbench) => workbench.dispose());
    ProjectIssueBoard.publish({ diagnostics: [], problems: [] });
  });

  it('registers the run configuration tools', () => {
    const names = MCP_TOOL_DEFINITIONS.map((definition) => definition.name);
    expect(names).toEqual(
      expect.arrayContaining(['list_run_configurations', 'set_run_configurations', 'run_configuration']),
    );
  });

  it('lists the default Play and the step kinds before anything is stored', async () => {
    const { api } = await runConfigurationApiRigCreate();
    const listed = await api.invokeToolAsync('list_run_configurations');
    expect(listed.ok).toBe(true);
    expect(listed.data).toMatchObject({ isStoredInProject: false, activeId: 'play' });
    const stepKinds = (listed.data as { stepKinds: { id: string }[] }).stepKinds.map((kind) => kind.id);
    expect(stepKinds).toEqual(expect.arrayContaining(['level_save', 'level_package_build', 'command', 'game_play']));
  });

  it('stores a configuration, makes it active and runs its command', async () => {
    const { api, workbenchRig } = await runConfigurationApiRigCreate();
    const stored = await api.invokeToolAsync('set_run_configurations', {
      configurations: [MCP_TEST_CONFIGURATION],
      activeId: MCP_TEST_CONFIGURATION.id,
    });
    expect(stored.ok, stored.message).toBe(true);
    expect(stored.data).toMatchObject({ isStoredInProject: true, activeId: MCP_TEST_CONFIGURATION.id });
    expect((await api.invokeToolAsync('run_configuration')).ok).toBe(true);
    expect((await runStateEndedRead(api))?.phase).toBe('succeeded');
    expect(workbenchRig.control.commands.map((entry) => entry.command.arguments)).toEqual([
      MCP_TEST_CONFIGURATION.steps[0]?.arguments,
    ]);
  });

  it('refuses malformed configurations', async () => {
    const { api } = await runConfigurationApiRigCreate();
    const stored = await api.invokeToolAsync('set_run_configurations', { configurations: [{ id: 'x' }] });
    expect(stored.ok).toBe(false);
  });
});
