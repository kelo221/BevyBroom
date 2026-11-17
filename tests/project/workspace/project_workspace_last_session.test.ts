import { describe, expect, it } from 'vitest';
import { MemorySettingsStorage } from '@/settings/storage/settings_storage.js';
import {
  ProjectWorkspaceLastSession,
  type ProjectWorkspaceLastLevels,
  type ProjectWorkspaceLastProjects,
} from '@/project/workspace/project_workspace_last_session.js';
import {
  ProjectWorkspaceLastStore,
  type ProjectWorkspaceLast,
} from '@/project/workspace/project_workspace_last_store.js';

/** Project file used by the fake projects. */
const PROJECT_FILE = '/games/cart/broom.project.json';

/** Level documents the fake project lists. */
const LISTED_LEVELS = ['lv-store.scene.json', 'lv-lobby.scene.json'];

/**
 * Fake editor with an open project, a level list and an open level, calling
 * listeners on every change the way the workbench and level service do.
 */
class FakeWorkspaceEditor {
  openProjectFile: string | null = null;
  openLevelDocument: string | null = null;
  isProjectOpenable = true;
  readonly openedLevels: string[] = [];
  private readonly listeners = new Set<() => void>();

  /**
   * Returns the project side of the fake.
   *
   * @returns Project side.
   */
  projects(): ProjectWorkspaceLastProjects {
    return {
      isAvailable: () => true,
      projectOpen: (projectFile) => Promise.resolve(this.projectOpen(projectFile)),
      projectFileRead: () => this.openProjectFile,
      changeListenerAdd: (listener) => this.listenerAdd(listener),
    };
  }

  /**
   * Returns the level side of the fake.
   *
   * @returns Level side.
   */
  levels(): ProjectWorkspaceLastLevels {
    return {
      listIdle: () => Promise.resolve(),
      isLevelListed: (document) => LISTED_LEVELS.includes(document),
      levelOpen: (document) => Promise.resolve(this.levelOpen(document)),
      openLevelRead: () => this.openLevelRead(),
      changeListenerAdd: (listener) => this.listenerAdd(listener),
    };
  }

  /**
   * Opens a project, closing the open level.
   *
   * @param projectFile Project file.
   * @returns Whether it opened.
   */
  projectOpen(projectFile: string): { ok: boolean } {
    if (!this.isProjectOpenable) {
      return { ok: false };
    }
    this.openProjectFile = projectFile;
    this.openLevelDocument = null;
    this.changed();
    return { ok: true };
  }

  /**
   * Opens a level of the open project.
   *
   * @param document Level document.
   * @returns Whether it opened.
   */
  levelOpen(document: string): { ok: boolean } {
    this.openedLevels.push(document);
    this.openLevelDocument = document;
    this.changed();
    return { ok: true };
  }

  /**
   * Returns the open level.
   *
   * @returns Open level, or null.
   */
  private openLevelRead(): { projectFile: string; document: string } | null {
    if (this.openProjectFile === null || this.openLevelDocument === null) {
      return null;
    }
    return { projectFile: this.openProjectFile, document: this.openLevelDocument };
  }

  /**
   * Adds a change listener.
   *
   * @param listener Listener.
   * @returns Remover.
   */
  private listenerAdd(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Calls every change listener. */
  private changed(): void {
    this.listeners.forEach((listener) => listener());
  }
}

/**
 * Creates a store already remembering a workspace.
 *
 * @param workspace Remembered workspace, or null for none.
 * @returns Store on fresh memory storage.
 */
function storeWith(workspace: ProjectWorkspaceLast | null): ProjectWorkspaceLastStore {
  const store = new ProjectWorkspaceLastStore(new MemorySettingsStorage());
  if (workspace !== null) {
    store.write(workspace);
  }
  return store;
}

/**
 * Starts a session over a fake editor.
 *
 * @param editor Fake editor.
 * @param store Store of the last workspace.
 * @param isSceneRecovered Whether startup recovery replaced the scene.
 * @returns The started session.
 */
async function sessionStart(
  editor: FakeWorkspaceEditor,
  store: ProjectWorkspaceLastStore,
  isSceneRecovered = false,
): Promise<ProjectWorkspaceLastSession> {
  const session = new ProjectWorkspaceLastSession({
    store,
    projects: editor.projects(),
    levels: editor.levels(),
    recoveryDecided: Promise.resolve(isSceneRecovered),
  });
  await session.start();
  return session;
}

/**
 * The editor reopens the project and level that were open last time, and
 * remembers every project and level opened afterwards.
 */
describe('ProjectWorkspaceLastSession', () => {
  it('reopens the last project and its level', async () => {
    const editor = new FakeWorkspaceEditor();
    const [levelDocument = ''] = LISTED_LEVELS;
    await sessionStart(editor, storeWith({ projectFile: PROJECT_FILE, levelDocument }));
    expect(editor.openProjectFile).toBe(PROJECT_FILE);
    expect(editor.openedLevels).toEqual([levelDocument]);
  });

  it('keeps recovered work and the remembered level when recovery replaced the scene', async () => {
    const editor = new FakeWorkspaceEditor();
    const [levelDocument = ''] = LISTED_LEVELS;
    const store = storeWith({ projectFile: PROJECT_FILE, levelDocument });
    await sessionStart(editor, store, true);
    expect(editor.openProjectFile).toBe(PROJECT_FILE);
    expect(editor.openedLevels).toEqual([]);
  });

  it('skips a level the project no longer lists', async () => {
    const editor = new FakeWorkspaceEditor();
    await sessionStart(editor, storeWith({ projectFile: PROJECT_FILE, levelDocument: 'deleted.scene.json' }));
    expect(editor.openProjectFile).toBe(PROJECT_FILE);
    expect(editor.openedLevels).toEqual([]);
  });

  it('opens no level when the project fails to open, and keeps remembering it', async () => {
    const editor = new FakeWorkspaceEditor();
    editor.isProjectOpenable = false;
    const [levelDocument = ''] = LISTED_LEVELS;
    const remembered = { projectFile: PROJECT_FILE, levelDocument };
    const store = storeWith(remembered);
    await sessionStart(editor, store);
    expect(editor.openedLevels).toEqual([]);
    expect(store.read()).toEqual(remembered);
  });

  it('remembers projects and levels opened after startup', async () => {
    const editor = new FakeWorkspaceEditor();
    const store = storeWith(null);
    const session = await sessionStart(editor, store);
    const [, levelDocument = ''] = LISTED_LEVELS;
    editor.projectOpen(PROJECT_FILE);
    expect(store.read()).toEqual({ projectFile: PROJECT_FILE, levelDocument: null });
    editor.levelOpen(levelDocument);
    expect(store.read()).toEqual({ projectFile: PROJECT_FILE, levelDocument });
    session.dispose();
    editor.levelOpen(LISTED_LEVELS[0] ?? '');
    expect(store.read()?.levelDocument).toBe(levelDocument);
  });
});
