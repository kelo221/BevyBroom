import { LocalSettingsStorage, type SettingsStorage } from '@/settings/storage/settings_storage.js';

/** Storage key of the recently opened project files. */
export const PROJECT_RECENT_STORAGE_KEY = 'bevybroom.projects.recent';

/** Most recent project files remembered. */
export const PROJECT_RECENT_LIMIT = 8;

/** Remembers recently opened project files, newest first. */
export class ProjectRecentStore {
  private readonly storage: SettingsStorage | null;
  private projectFiles: string[];

  /**
   * Creates a store and loads the saved list.
   *
   * @param storage Settings storage, or null to keep the list in memory only.
   *   Defaults to browser local storage when available.
   */
  constructor(storage: SettingsStorage | null = ProjectRecentStore.storageDefault()) {
    this.storage = storage;
    this.projectFiles = ProjectRecentStore.listSanitize(this.storageRead());
  }

  /**
   * Returns the remembered project files, newest first.
   *
   * @returns Project file paths.
   */
  listRead(): readonly string[] {
    return this.projectFiles;
  }

  /**
   * Moves a project file to the front of the list and saves it.
   *
   * @param projectFile Absolute path of the opened project file.
   */
  remember(projectFile: string): void {
    const others = this.projectFiles.filter((existing) => existing !== projectFile);
    this.projectFiles = [projectFile, ...others].slice(0, PROJECT_RECENT_LIMIT);
    this.persist();
  }

  /**
   * Removes a project file, for example one that no longer opens, and saves.
   *
   * @param projectFile Path to forget.
   */
  forget(projectFile: string): void {
    this.projectFiles = this.projectFiles.filter((existing) => existing !== projectFile);
    this.persist();
  }

  /**
   * Keeps only distinct non-empty strings, at most the limit.
   *
   * @param value Parsed stored value.
   * @returns Clean list.
   */
  static listSanitize(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    const strings = value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
    return [...new Set(strings)].slice(0, PROJECT_RECENT_LIMIT);
  }

  /**
   * Returns local storage when the environment has it.
   *
   * @returns Local settings storage, or null.
   */
  private static storageDefault(): SettingsStorage | null {
    return typeof localStorage !== 'undefined' ? new LocalSettingsStorage(localStorage) : null;
  }

  /**
   * Reads and parses the stored JSON.
   *
   * @returns Parsed value, or null when nothing valid is stored.
   */
  private storageRead(): unknown {
    try {
      const raw = this.storage?.getItem(PROJECT_RECENT_STORAGE_KEY) ?? null;
      return raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      return null;
    }
  }

  /** Writes the current list. */
  private persist(): void {
    try {
      this.storage?.setItem(PROJECT_RECENT_STORAGE_KEY, JSON.stringify(this.projectFiles));
    } catch {
      return;
    }
  }
}
