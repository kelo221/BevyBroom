import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import { MCP_TOOL_DEFINITIONS } from '@/ai/server/registry_mcp_tool.js';
import {
  GAME_PROCESS_DESKTOP_ONLY_MESSAGE,
  GameProcessControlUnavailable,
} from '@/project/control/game_process_control.js';
import { ProjectWorkbench } from '@/project/workbench/project_workbench.js';
import { ProjectRecentStore } from '@/project/recent/project_recent_store.js';
import { ProjectIssueBoard } from '@/project/issues/project_issue_board.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';
import { ProjectWorkbenchLinkFake, workbenchRigCreate } from '../../project/workbench/project_workbench_rig.js';

const workbenches: ProjectWorkbench[] = [];

/**
 * Builds an editor API whose project workbench uses the fake process control.
 *
 * @returns API, world and workbench rig.
 */
function projectApiRigCreate() {
  const world = new THREE.Group();
  const workbenchRig = workbenchRigCreate(world);
  workbenches.push(workbenchRig.workbench);
  const parts = editorApiTestHostCreate({ worldObject: world, projectWorkbenchEnsure: () => workbenchRig.workbench });
  return { api: new EditorApi(parts.host), world, workbenchRig };
}

/**
 * Unit tests for the project MCP tools: they are registered, open projects and
 * start actions through the workbench, report which project the document and
 * game must belong to, and explain the browser limits.
 */
describe('EditorApiProject', () => {
  afterEach(() => {
    workbenches.splice(0).forEach((workbench) => workbench.dispose());
    ProjectIssueBoard.publish({ diagnostics: [], problems: [] });
  });

  it('registers every project tool', () => {
    const names = MCP_TOOL_DEFINITIONS.map((definition) => definition.name);
    const projectTools = ['project_open', 'project_status', 'game_launch', 'game_rebuild', 'game_restart', 'game_stop'];
    expect(names).toEqual(expect.arrayContaining(projectTools));
  });

  it('opens a project, links the document and starts game actions', async () => {
    const rig = projectApiRigCreate();
    const opened = await rig.api.invokeToolAsync('project_open', { path: '/games/mcp game/broom.project.json' });
    expect(opened.ok).toBe(true);
    expect(opened.data).toMatchObject({ documentProjectId: 'id-mcp game', expectedProjectId: 'id-mcp game' });
    const launched = await rig.api.invokeToolAsync('game_launch');
    const stopped = await rig.api.invokeToolAsync('game_stop');
    expect(launched.ok && stopped.ok).toBe(true);
    expect(rig.workbenchRig.control.actions).toEqual(['launch', 'stop']);
    const status = await rig.api.invokeToolAsync('project_status');
    expect(status.data).toMatchObject({ canManageGames: true, project: { name: 'mcp game' } });
  });

  it('fails clearly without a path or when the project does not open', async () => {
    const rig = projectApiRigCreate();
    expect((await rig.api.invokeToolAsync('project_open', {})).ok).toBe(false);
    const missing = await rig.api.invokeToolAsync('project_open', { path: '/games/missing/broom.project.json' });
    expect(missing.ok).toBe(false);
    expect(missing.message).toContain('missing');
  });

  it('explains that only the desktop app manages games', async () => {
    const world = new THREE.Group();
    const workbench = new ProjectWorkbench({
      control: new GameProcessControlUnavailable(),
      link: new ProjectWorkbenchLinkFake(),
      worldGroup: world,
      recentStore: new ProjectRecentStore(null),
    });
    workbenches.push(workbench);
    const api = new EditorApi(
      editorApiTestHostCreate({ worldObject: world, projectWorkbenchEnsure: () => workbench }).host,
    );
    const launched = await api.invokeToolAsync('game_launch');
    expect(launched).toMatchObject({ ok: false, message: GAME_PROCESS_DESKTOP_ONLY_MESSAGE });
    const status = await api.invokeToolAsync('project_status');
    expect(status.data).toMatchObject({ canManageGames: false, project: null });
  });
});
