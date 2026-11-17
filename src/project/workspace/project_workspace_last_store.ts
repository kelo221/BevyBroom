import { LocalSettingsStorage, type SettingsStorage } from '@/settings/storage/settings_storage.js';

/** Settings storage key of the last open project and level. */
export const PROJECT_WORKSPACE_LAST_STORAGE_KEY = 'bevybroom.workspace.last';

/** The project and level that were open when the editor was last used. */
export interface ProjectWorkspaceLast {
  /** Path of the project file. */
  readonly projectFile: string;
  /**
   * Document path of the open level relative to the document directory, or
   * null.
   */
  readonly levelDocument: string | null;
}

/**
 * Remembers the last open project and level across editor sessions in the
 * editor's settings storage.
 */
export class ProjectWorkspaceLastStore {
  private readonly storage: SettingsStorage | null;

  /**
   * Creates the store.
   *
   * @param storage Settings storage, or null where nothing can be stored.
   */
  constructor(storage: SettingsStorage | null = ProjectWorkspaceLastStore.storageDefault()) {
    this.storage = storage;
  }

  /**
   * Returns the remembered project and level.
   *
   * @returns The last workspace, or null when nothing valid is remembered.
   */
  read(): ProjectWorkspaceLast | null {
    try {
      const raw = this.storage?.getItem(PROJECT_WORKSPACE_LAST_STORAGE_KEY) ?? null;
      return raw === null ? null : ProjectWorkspaceLastStore.sanitize(JSON.parse(raw) as unknown);
    } catch {
      return null;
    }
  }

  /**
   * Remembers a project and level, replacing what was remembered before.
   *
   * @param workspace Project and level to remember.
   */
  write(workspace: ProjectWorkspaceLast): void {
    try {
      this.storage?.setItem(PROJECT_WORKSPACE_LAST_STORAGE_KEY, JSON.stringify(workspace));
    } catch {
      return;
    }
  }

  /** Forgets the remembered project and level. */
  clear(): void {
    try {
      this.storage?.removeItem(PROJECT_WORKSPACE_LAST_STORAGE_KEY);
    } catch {
      return;
    }
  }

  /**
   * Reads an untrusted stored value.
   *
   * @param value Parsed stored value.
   * @returns The workspace, or null when the value has no project file.
   */
  static sanitize(value: unknown): ProjectWorkspaceLast | null {
    if (typeof value !== 'object' || value === null) {
      return null;
    }
    const { projectFile, levelDocument } = value as Record<string, unknown>;
    if (typeof projectFile !== 'string' || projectFile === '') {
      return null;
    }
    const isLevelNamed = typeof levelDocument === 'string' && levelDocument !== '';
    return { projectFile, levelDocument: isLevelNamed ? levelDocument : null };
  }

  /**
   * Returns the browser's local storage when there is one.
   *
   * @returns Settings storage, or null.
   */
  private static storageDefault(): SettingsStorage | null {
    return typeof localStorage !== 'undefined' ? new LocalSettingsStorage(localStorage) : null;
  }
}
