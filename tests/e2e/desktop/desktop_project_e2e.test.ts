import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import type { SceneJSON } from '@/io/scene/io_types.js';
import type { PreviewBridgeStatus } from '@/preview/protocol/preview_protocol_types.js';
import type { GameProcessPhase, GameProcessStatus } from '@/project/process/game_process_types.js';
import { previewE2eProjectRemove } from '../preview_e2e_game_process.js';
import {
  e2eRequiredConfigurationAssert,
  e2eWindowsShownRead,
  previewE2eEnvironmentRead,
} from '../preview_e2e_environment.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';
import {
  desktopE2eBuildSourceWrite,
  desktopE2eProcessIsAlive,
  desktopE2eProjectPrepare,
  type DesktopE2eProject,
} from './desktop_e2e_project_files.js';

/**
 * End-to-end acceptance of opening a game project in the built desktop app and
 * letting the app build, launch, rebuild, restart and stop the game, driven
 * through its MCP server. Needs BROOM_E2E_DESKTOP_EXE, BROOM_E2E_PREVIEW_EXE,
 * BROOM_E2E_PROJECT_DIR and cargo on the PATH.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const isCargoAvailable = spawnSync('cargo', ['--version'], { stdio: 'ignore' }).status === 0;
const mcpBasePort = Number(process.env['BROOM_E2E_PROJECT_MCP_PORT'] ?? '18905');
const environmentFirst = previewE2eEnvironmentRead(10);
const environmentSecond = previewE2eEnvironmentRead(11);
const isConfigured = desktopExecutable !== '' && environmentFirst.isConfigured && isCargoAvailable;
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const BUILD_TIMEOUT_MILLISECONDS = 180000;

/** Project status returned by the project tools. */
type DesktopE2eProjectStatus = GameProcessStatus & {
  canManageGames: boolean;
  documentProjectId: string | null;
  expectedProjectId: string | null;
};

/** Game preview view returned by the preview_status tool. */
interface DesktopE2ePreviewStatus {
  connection: string;
  revisions: { state: number; geometry: number } | null;
  game: PreviewBridgeStatus | null;
  lastError: string;
}

/**
 * Returns the data of a tool result as a given shape.
 *
 * @param result Successful tool result.
 * @returns The result data.
 */
function toolDataRead<Data>(result: McpToolResult): Data {
  return result.data as Data;
}

describe.skipIf(!isConfigured)('desktop app game project end to end', () => {
  const app = new DesktopE2eAppProcess(desktopExecutable, mcpBasePort, e2eWindowsShownRead());
  let client: DesktopE2eMcpClient;
  let projectFirst: DesktopE2eProject;
  let projectSecond: DesktopE2eProject;
  let firstInstanceIdentifier = '';
  let documentIdentifier = '';
  let lastProcessIdentifier = 0;

  /**
   * Prepares a game project on the port of an environment.
   *
   * @param projectIdentifier Project id written into the project file.
   * @param bridgePort Bridge port of its game.
   * @returns The prepared project.
   */
  function projectPrepare(projectIdentifier: string, bridgePort: number): DesktopE2eProject {
    return desktopE2eProjectPrepare({
      sourceProjectDirectory: environmentFirst.sourceProjectDirectory,
      previewExecutable: environmentFirst.previewExecutable,
      projectIdentifier,
      bridgePort,
      isWindowShown: e2eWindowsShownRead(),
    });
  }

  /**
   * Reads the project status.
   *
   * @returns Status of the open project and its game.
   */
  async function projectStatusRead(): Promise<DesktopE2eProjectStatus> {
    return toolDataRead<DesktopE2eProjectStatus>(await client.toolCallExpectOk('project_status'));
  }

  /**
   * Waits until the managed game reaches a phase.
   *
   * @param phase Awaited phase.
   * @returns The matching status.
   */
  async function phaseWait(phase: GameProcessPhase): Promise<DesktopE2eProjectStatus> {
    return desktopE2eWaitUntil(
      `the game to reach ${phase}`,
      async () => {
        const status = await projectStatusRead();
        return status.phase === phase ? status : null;
      },
      BUILD_TIMEOUT_MILLISECONDS,
    );
  }

  /**
   * Waits until the link is connected to a new game instance of a project that
   * applied everything the editor sent.
   *
   * @param projectIdentifier Project the game must run.
   * @param previousInstanceIdentifier Instance that must have been replaced.
   * @returns Matching preview status.
   */
  async function gameCaughtUpWait(
    projectIdentifier: string,
    previousInstanceIdentifier: string,
  ): Promise<DesktopE2ePreviewStatus> {
    return desktopE2eWaitUntil(
      `a new game of ${projectIdentifier} to apply the document`,
      async () => {
        const status = toolDataRead<DesktopE2ePreviewStatus>(await client.toolCallExpectOk('preview_status'));
        const game = status.game;
        const isNewGame =
          game !== null && game.project_id === projectIdentifier && game.instance_id !== previousInstanceIdentifier;
        const isCaughtUp =
          isNewGame && status.revisions !== null && game.state_revision_applied === status.revisions.state;
        return status.connection === 'connected' && isCaughtUp ? status : null;
      },
      LAUNCH_TIMEOUT_MILLISECONDS,
    );
  }

  beforeAll(async () => {
    const suffix = Math.random().toString(36).slice(2, 8);
    projectFirst = projectPrepare(`broom-e2e-first-${suffix}`, environmentFirst.bridgePort);
    projectSecond = projectPrepare(`broom-e2e-second-${suffix}`, environmentSecond.bridgePort);
    app.start();
    client = new DesktopE2eMcpClient(await app.mcpUrlWait(LAUNCH_TIMEOUT_MILLISECONDS));
    await client.initialize();
    await desktopE2eWaitUntil(
      'the editor to answer tools',
      async () => ((await client.toolCall('get_editor_context')).ok ? true : null),
      LAUNCH_TIMEOUT_MILLISECONDS,
    );
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await client?.toolCall('game_stop').catch(() => undefined);
    await app.stop();
    [projectFirst, projectSecond].forEach((project) => project && previewE2eProjectRemove(project.directory));
  });

  it(
    'opens a project and links the unlinked document to it',
    async () => {
      const opened = await client.toolCallExpectOk('project_open', { path: projectFirst.projectFile });
      const status = toolDataRead<DesktopE2eProjectStatus>(opened);
      expect(status.canManageGames).toBe(true);
      expect(status.project?.projectIdentifier).toBe(projectFirst.projectIdentifier);
      expect(status.project?.problems.filter((problem) => problem.severity === 'error')).toEqual([]);
      expect(status.documentProjectId).toBe(projectFirst.projectIdentifier);
    },
    LAUNCH_TIMEOUT_MILLISECONDS,
  );

  it(
    'builds and launches the game, which applies an edit of the document',
    async () => {
      await client.toolCallExpectOk('game_launch');
      const running = await phaseWait('running');
      lastProcessIdentifier = running.processId ?? 0;
      expect(desktopE2eProcessIsAlive(lastProcessIdentifier)).toBe(true);
      await client.toolCallExpectOk('create_solid_model', { name: `ProjectProbe${Date.now()}` });
      const caughtUp = await gameCaughtUpWait(projectFirst.projectIdentifier, '');
      firstInstanceIdentifier = caughtUp.game?.instance_id ?? '';
      const document = toolDataRead<{ json: string }>(await client.toolCallExpectOk('get_scene_document'));
      documentIdentifier = (JSON.parse(document.json) as SceneJSON).documentId ?? '';
      expect(caughtUp.game?.document_id).toBe(documentIdentifier);
    },
    BUILD_TIMEOUT_MILLISECONDS,
  );

  it(
    'reports a compile error with its location in the Console and the Issues list',
    async () => {
      desktopE2eBuildSourceWrite(projectFirst.directory, false);
      await client.toolCallExpectOk('game_rebuild');
      const failed = await phaseWait('build_failed');
      const error = failed.diagnostics.find((diagnostic) => diagnostic.severity === 'error');
      expect(error?.file.endsWith('main.rs')).toBe(true);
      expect(error?.line).toBe(2);
      expect(desktopE2eProcessIsAlive(lastProcessIdentifier)).toBe(false);
      const issues = toolDataRead<{ issues: Array<{ description: string }> }>(
        await client.toolCallExpectOk('issues_list'),
      );
      expect(issues.issues.some((issue) => issue.description.includes('main.rs:2:'))).toBe(true);
      const consoleLines = toolDataRead<{ lines: Array<{ text: string }> }>(
        await client.toolCallExpectOk('console_read', { limit: 1000 }),
      );
      expect(consoleLines.lines.some((line) => line.text.includes('main.rs:2:'))).toBe(true);
    },
    BUILD_TIMEOUT_MILLISECONDS,
  );

  it(
    'rebuilds after the fix and the new game shows the same document',
    async () => {
      desktopE2eBuildSourceWrite(projectFirst.directory, true);
      await client.toolCallExpectOk('game_rebuild');
      const running = await phaseWait('running');
      expect(running.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
      const caughtUp = await gameCaughtUpWait(projectFirst.projectIdentifier, firstInstanceIdentifier);
      expect(caughtUp.game?.document_id).toBe(documentIdentifier);
      firstInstanceIdentifier = caughtUp.game?.instance_id ?? '';
      lastProcessIdentifier = running.processId ?? 0;
    },
    BUILD_TIMEOUT_MILLISECONDS,
  );

  it(
    'restarts the game without building and stops it',
    async () => {
      await client.toolCallExpectOk('game_restart');
      const caughtUp = await gameCaughtUpWait(projectFirst.projectIdentifier, firstInstanceIdentifier);
      expect(caughtUp.game?.document_id).toBe(documentIdentifier);
      const running = await phaseWait('running');
      expect(running.processId).not.toBe(lastProcessIdentifier);
      await client.toolCallExpectOk('game_stop');
      const stopped = await phaseWait('stopped');
      expect(stopped.processId).toBeNull();
      expect(desktopE2eProcessIsAlive(running.processId ?? 0)).toBe(false);
    },
    BUILD_TIMEOUT_MILLISECONDS,
  );

  it(
    'refuses to publish the document into the game of another project',
    async () => {
      const opened = await client.toolCallExpectOk('project_open', { path: projectSecond.projectFile });
      const status = toolDataRead<DesktopE2eProjectStatus>(opened);
      expect(status.documentProjectId).toBe(projectFirst.projectIdentifier);
      expect(status.expectedProjectId).toBe(projectFirst.projectIdentifier);
      await client.toolCallExpectOk('game_launch');
      await phaseWait('running');
      const refused = await desktopE2eWaitUntil(
        'the link to refuse the other project',
        async () => {
          const preview = toolDataRead<DesktopE2ePreviewStatus>(await client.toolCallExpectOk('preview_status'));
          return preview.connection === 'incompatible' ? preview : null;
        },
        LAUNCH_TIMEOUT_MILLISECONDS,
      );
      expect(refused.lastError).toContain(projectFirst.projectIdentifier);
      expect(refused.game?.state_revision_received ?? 0).toBe(0);
      await client.toolCallExpectOk('game_stop');
      await phaseWait('stopped');
    },
    BUILD_TIMEOUT_MILLISECONDS,
  );
});
