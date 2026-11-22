import { LocalSettingsStorage, type SettingsStorage } from '@/settings/storage/settings_storage.js';

/** Storage key of the active run configuration of every project. */
export const RUN_CONFIGURATION_ACTIVE_STORAGE_KEY = 'bevybroom.run_configurations.active';

/**
 * Remembers on this computer which run configuration F9 runs in each project,
 * so the shared project file does not change when someone picks another one.
 */
export class RunConfigurationActiveStore {
  private readonly storage: SettingsStorage | null;
  private activeByProject: Record<string, string>;

  /**
   * Creates the store and reads what it remembered.
   *
   * @param storage Where the choice is kept; browser storage by default.
   */
  constructor(storage: SettingsStorage | null = RunConfigurationActiveStore.storageDefault()) {
    this.storage = storage;
    this.activeByProject = this.storageRead();
  }

  /**
   * Returns the active configuration of a project.
   *
   * @param projectFile Project file path.
   * @returns Configuration id, or null when none was picked.
   */
  activeRead(projectFile: string): string | null {
    return this.activeByProject[projectFile] ?? null;
  }

  /**
   * Remembers the active configuration of a project.
   *
   * @param projectFile Project file path.
   * @param configurationId Configuration id.
   */
  activeWrite(projectFile: string, configurationId: string): void {
    this.activeByProject = { ...this.activeByProject, [projectFile]: configurationId };
    try {
      this.storage?.setItem(RUN_CONFIGURATION_ACTIVE_STORAGE_KEY, JSON.stringify(this.activeByProject));
    } catch {
      return;
    }
  }

  /**
   * Returns browser storage when the page has it.
   *
   * @returns Storage, or null outside a browser.
   */
  private static storageDefault(): SettingsStorage | null {
    return typeof localStorage !== 'undefined' ? new LocalSettingsStorage(localStorage) : null;
  }

  /**
   * Reads the remembered choices, ignoring anything malformed.
   *
   * @returns Configuration ids by project file.
   */
  private storageRead(): Record<string, string> {
    try {
      const parsed: unknown = JSON.parse(this.storage?.getItem(RUN_CONFIGURATION_ACTIVE_STORAGE_KEY) ?? '{}');
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return {};
      }
      const entries = Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
      return Object.fromEntries(entries);
    } catch {
      return {};
    }
  }
}
