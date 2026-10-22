import { afterEach, describe, expect, it } from 'vitest';
import type { ProjectWorkbench } from '@/project/workbench/project_workbench.js';
import { documentProjectLinkRead, documentProjectLinkWrite } from '@/project/document/document_project_link.js';
import { ProjectIssueBoard } from '@/project/issues/project_issue_board.js';
import { IssueProviderProjectBuild } from '@/project/issues/issue_provider_project_build.js';
import { gameStatusCreate, workbenchRigCreate } from './project_workbench_rig.js';

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
});
