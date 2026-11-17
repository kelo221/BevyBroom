import type { ProjectLevelActions } from '@/project/level/project_level_actions.js';
import type { ProjectWorkbench } from '@/project/workbench/project_workbench.js';
import {
  ProjectWorkspaceLastSession,
  type ProjectWorkspaceLastLevels,
  type ProjectWorkspaceLastProjects,
} from '@/project/workspace/project_workspace_last_session.js';
import { ProjectWorkspaceLastStore } from '@/project/workspace/project_workspace_last_store.js';

/**
 * Creates and starts the session that reopens the last project and level and
 * remembers new ones.
 *
 * @param workbench Project workbench.
 * @param levelActions Level actions of the editor.
 * @param recoveryDecided Settles true once recovered work replaced the scene,
 *   false otherwise.
 * @param store Store of the last workspace.
 * @returns The started session.
 */
export function projectWorkspaceLastSessionStart(
  workbench: ProjectWorkbench,
  levelActions: ProjectLevelActions,
  recoveryDecided: Promise<boolean>,
  store: ProjectWorkspaceLastStore = new ProjectWorkspaceLastStore(),
): ProjectWorkspaceLastSession {
  const session = new ProjectWorkspaceLastSession({
    store,
    projects: projectWorkspaceLastProjectsCreate(workbench),
    levels: projectWorkspaceLastLevelsCreate(levelActions),
    recoveryDecided,
  });
  void session.start();
  return session;
}

/**
 * Adapts the workbench to the project side of the session.
 *
 * @param workbench Project workbench.
 * @returns Project side.
 */
function projectWorkspaceLastProjectsCreate(workbench: ProjectWorkbench): ProjectWorkspaceLastProjects {
  return {
    isAvailable: () => workbench.isAvailable(),
    projectOpen: (projectFile) => workbench.projectOpen(projectFile),
    projectFileRead: () => workbench.statusRead()?.project?.projectFile ?? null,
    changeListenerAdd: (listener) => workbench.changeListenerAdd(listener),
  };
}

/**
 * Adapts the level actions to the level side of the session.
 *
 * @param levelActions Level actions of the editor.
 * @returns Level side.
 */
function projectWorkspaceLastLevelsCreate(levelActions: ProjectLevelActions): ProjectWorkspaceLastLevels {
  return {
    listIdle: () => levelActions.serviceRead().idle(),
    isLevelListed: (document) => levelActions.serviceRead().levelFind(document) !== null,
    levelOpen: (document) => levelActions.levelOpen(document, false),
    openLevelRead: () => levelActions.serviceRead().openLevelRead(),
    changeListenerAdd: (listener) => levelActions.serviceRead().changeListenerAdd(listener),
  };
}
