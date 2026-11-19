import { afterEach, describe, expect, it } from 'vitest';
import type { ProjectWorkbench } from '@/project/workbench/project_workbench.js';
import { documentProjectLinkRead, documentProjectLinkWrite } from '@/project/document/document_project_link.js';
import { ProjectIssueBoard } from '@/project/issues/project_issue_board.js';
import { IssueProviderProjectBuild } from '@/project/issues/issue_provider_project_build.js';
import { gameStatusCreate, workbenchRigCreate } from './project_workbench_rig.js';
import type { ProjectLevelOpen } from '@/project/level/project_level_open.js';
import { PROJECT_WORKBENCH_LAUNCH_LEVEL_MISSING_TEXT } from '@/project/workbench/project_workbench_launch_level_text.js';

/**
 * Opens a project whose game starts in the open level, with a scene that
 * belongs to one of its levels or to none.
 *
 * @param levelId Id of the open level, or null for a scene of no level.
 * @param openLevelSave Saves the open level; levels are not saved without it.
 * @param isLevelExportLaunch Whether the game reads the level's package.
 * @returns Rig with the project open.
 */
async function levelLaunchRigCreate(
  levelId: string | null,
  openLevelSave?: () => Promise<string | null>,
  isLevelExportLaunch = true,
) {
  const projectFile = '/games/zeta/broom.project.json';
  const openLevel: ProjectLevelOpen | null =
    levelId === null
      ? null
      : {
          projectFile,
          id: levelId,
          name: `Level ${levelId}`,
          document: `${levelId}.json`,
          knownModifiedMilliseconds: 1,
        };
  const rig = workbenchRigCreate(undefined, () => openLevel, openLevelSave);
  workbenches.push(rig.workbench);
  await rig.workbench.projectOpen(projectFile);
  const status = rig.workbench.statusRead();
  if (status?.project) {
    status.project.isLevelLaunch = true;
    status.project.isLevelExportLaunch = isLevelExportLaunch;
  }
  return rig;
}

const workbenches: ProjectWorkbench[] = [];

/**
 * Unit tests for the project workbench: opening links the document and points
 * the preview at the project's game, recent projects follow opens, starts
 * connect the link, a document of another project is reported and can be
 * relinked, and build errors reach the console and the Issues list.
 */
describe('ProjectWorkbench', () => {
  afterEach(() => {
    workbenches.splice(0).forEach((workbench) => workbench.dispose());
    ProjectIssueBoard.publish({ diagnostics: [], problems: [] });
  });

  it('opens a project, links the unlinked document and points the link at its game', async () => {
    const rig = workbenchRigCreate();
    workbenches.push(rig.workbench);
    const result = await rig.workbench.projectOpen('/games/alpha game/broom.project.json');
    expect(result.ok).toBe(true);
    expect(documentProjectLinkRead(rig.worldGroup)).toBe('id-alpha game');
    expect(rig.link.endpoints).toEqual(['http://127.0.0.1:1/alpha game']);
    expect(rig.recentStore.listRead()).toEqual(['/games/alpha game/broom.project.json']);
    expect(rig.workbench.expectedProjectIdentifierRead()).toBe('id-alpha game');
  });

  it('asks for a file when none is given and treats a cancelled choice as no change', async () => {
    const rig = workbenchRigCreate();
    workbenches.push(rig.workbench);
    expect(await rig.workbench.projectOpen(null)).toEqual({ ok: false, message: '' });
    rig.control.chosenFile = '/games/beta/broom.project.json';
    expect((await rig.workbench.projectOpen(null)).ok).toBe(true);
    expect(rig.workbench.statusRead()?.project?.name).toBe('beta');
  });

  it('counts successful opens, including a second open of the same file, but not failed ones', async () => {
    const rig = workbenchRigCreate();
    workbenches.push(rig.workbench);
    const countBefore = rig.workbench.projectOpenCountRead();
    await rig.workbench.projectOpen('/games/delta/broom.project.json');
    await rig.workbench.projectOpen('/games/delta/broom.project.json');
    await rig.workbench.projectOpen('/games/missing/broom.project.json');
    expect(rig.workbench.projectOpenCountRead() - countBefore).toBe(2);
  });

  it('forgets a recent project that no longer opens', async () => {
    const rig = workbenchRigCreate();
    workbenches.push(rig.workbench);
    rig.recentStore.remember('/games/missing/broom.project.json');
    const result = await rig.workbench.projectOpen('/games/missing/broom.project.json');
    expect(result.ok).toBe(false);
    expect(rig.recentStore.listRead()).toEqual([]);
  });

  it('connects the link when the game starts and not when it stops', async () => {
    const rig = workbenchRigCreate();
    workbenches.push(rig.workbench);
    await rig.workbench.projectOpen('/games/gamma/broom.project.json');
    await rig.workbench.actionRun('stop');
    expect(rig.link.connectCount).toBe(0);
    await rig.workbench.actionRun('launch');
    await rig.workbench.actionRun('restart');
    expect(rig.control.actions).toEqual(['stop', 'launch', 'restart']);
    expect(rig.link.connectCount).toBe(1);
  });

  it('keeps the document project, reports the disagreement and relinks on request', async () => {
    const rig = workbenchRigCreate();
    workbenches.push(rig.workbench);
    documentProjectLinkWrite(rig.worldGroup, 'id-other');
    await rig.workbench.projectOpen('/games/delta/broom.project.json');
    expect(rig.workbench.expectedProjectIdentifierRead()).toBe('id-other');
    expect(rig.workbench.isDocumentLinkedElsewhere()).toBe(true);
    rig.link.isActive = true;
    rig.workbench.documentRelink();
    expect(rig.workbench.expectedProjectIdentifierRead()).toBe('id-delta');
    expect(rig.workbench.isDocumentLinkedElsewhere()).toBe(false);
    expect(rig.link.connectCount).toBe(1);
  });

  it('shows build errors in the console and the Issues list', async () => {
    const rig = workbenchRigCreate();
    workbenches.push(rig.workbench);
    await rig.workbench.projectOpen('/games/epsilon/broom.project.json');
    const failed = gameStatusCreate(rig.workbench.statusRead()?.project ?? null, 'build_failed');
    failed.generation = 2;
    failed.diagnostics = [
      { severity: 'error', message: 'cannot find value `speed`', file: 'src/main.rs', line: 7, column: 3 },
    ];
    rig.control.nextStatus = failed;
    await rig.workbench.statusRefresh();
    const consoleTexts = rig.consoleLog.entriesRead().map((entry) => entry.text);
    expect(consoleTexts).toContain('src/main.rs:7:3: cannot find value `speed`');
    const issues = new IssueProviderProjectBuild().collect();
    expect(issues.map((issue) => issue.description)).toEqual(['src/main.rs:7:3: cannot find value `speed`']);
    expect(issues[0]?.severity).toBe('error');
  });

  it('builds the open level before the game starts and starts the game in it', async () => {
    const rig = await levelLaunchRigCreate('store');
    expect(rig.workbench.launchLevelTextRead()).toContain('(store)');
    await rig.workbench.actionRun('launch');
    expect(rig.control.publishedLevels.map((request) => request.levelName)).toEqual(['store']);
    expect(rig.control.actionLevels).toEqual([{ levelId: 'store', levelDocument: 'store.json' }]);
    await rig.workbench.actionRun('stop');
    expect(rig.control.actionLevels.at(-1)).toBeNull();
    expect(rig.control.publishedLevels).toHaveLength(1);
  });

  it('does not start the game when the open level does not build', async () => {
    const rig = await levelLaunchRigCreate('lobby');
    rig.control.nextPublishResult = { ok: false, message: 'Disk full.' };
    const status = await rig.workbench.actionRun('restart');
    expect(rig.control.actions).toEqual([]);
    expect(status.message).toContain('lobby');
    expect(status.message).toContain('Disk full.');
  });

  it('passes no level when none is open, so the game refuses to start', async () => {
    const rig = await levelLaunchRigCreate(null);
    expect(rig.workbench.launchLevelTextRead()).toBe(PROJECT_WORKBENCH_LAUNCH_LEVEL_MISSING_TEXT);
    await rig.workbench.actionRun('launch');
    expect(rig.control.actionLevels).toEqual([null]);
    expect(rig.control.publishedLevels).toEqual([]);
  });

  it('builds nothing and names no level for a game that takes no level', async () => {
    const rig = workbenchRigCreate(undefined, () => ({
      projectFile: '/games/eta/broom.project.json',
      id: 'store',
      name: 'Store',
      document: 'store.json',
      knownModifiedMilliseconds: 1,
    }));
    workbenches.push(rig.workbench);
    await rig.workbench.projectOpen('/games/eta/broom.project.json');
    await rig.workbench.actionRun('launch');
    expect(rig.control.publishedLevels).toEqual([]);
    expect(rig.control.actionLevels).toEqual([null]);
    expect(rig.workbench.launchLevelTextRead()).toBeNull();
  });

  it('saves the open level before it builds it and starts nothing when the save is refused', async () => {
    const steps: string[] = [];
    let saveRefusal: string | null = null;
    const rig = await levelLaunchRigCreate('store', async () => {
      steps.push('save');
      return saveRefusal;
    });
    await rig.workbench.actionRun('launch');
    expect(steps).toEqual(['save']);
    expect(rig.control.publishedLevels).toHaveLength(1);
    expect(rig.control.actions).toEqual(['launch']);
    saveRefusal = 'The document changed on disk.';
    const status = await rig.workbench.actionRun('restart');
    expect(status.message).toContain(saveRefusal);
    expect(rig.control.publishedLevels).toHaveLength(1);
    expect(rig.control.actions).toEqual(['launch']);
  });

  it('plays the level with a start, then a rebuild while the game runs, or a restart when it cannot be built', async () => {
    const rig = await levelLaunchRigCreate('store');
    await rig.workbench.levelPlay();
    const statusRunning = (phase: 'running' | 'idle', canBuild: boolean) => {
      const status = rig.workbench.statusRead();
      if (!status?.project) throw new Error('expected an open project');
      rig.control.nextStatus = { ...status, phase, project: { ...status.project, canBuild } };
      return rig.workbench.statusRefresh();
    };
    await statusRunning('running', true);
    await rig.workbench.levelPlay();
    await statusRunning('running', false);
    await rig.workbench.levelPlay();
    expect(rig.control.actions).toEqual(['launch', 'rebuild', 'restart']);
    expect(rig.control.actionLevels.every((level) => level?.levelId === 'store')).toBe(true);
  });

  it('saves but does not build a level whose game reads only the saved document', async () => {
    const steps: string[] = [];
    const save = async () => {
      steps.push('save');
      return null;
    };
    const rig = await levelLaunchRigCreate('lobby', save, false);
    await rig.workbench.actionRun('launch');
    expect(steps).toEqual(['save']);
    expect(rig.control.publishedLevels).toEqual([]);
    expect(rig.control.actionLevels).toEqual([{ levelId: 'lobby', levelDocument: 'lobby.json' }]);
  });
});
