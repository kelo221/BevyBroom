import { LocalSettingsStorage, type SettingsStorage } from '@/settings/storage/settings_storage.js';
import {
  entityBrowserViewOptionsSanitize,
  type EntityBrowserViewOptions,
} from '@/entity_browser/view/entity_browser_view_options.js';

/** Storage key of the saved entity browser display choices. */
export const ENTITY_BROWSER_SETTINGS_STORAGE_KEY = 'bevybroom.settings.entity_browser';

/** Loads, updates and saves the entity browser display choices. */
export class EntityBrowserSettingsStore {
  private readonly storage: SettingsStorage | null;
  private options: EntityBrowserViewOptions;

  /**
   * Creates a store and loads the saved choices.
   *
   * @param storage Settings storage, or null to keep the choices in memory
   *   only. Defaults to browser local storage when available.
   */
  constructor(storage: SettingsStorage | null = EntityBrowserSettingsStore.storageDefault()) {
    this.storage = storage;
    this.options = entityBrowserViewOptionsSanitize(this.storageRead());
  }

  /**
   * Returns the current display choices.
   *
   * @returns Display choices.
   */
  optionsRead(): EntityBrowserViewOptions {
    return this.options;
  }

  /**
   * Changes some display choices and saves the result.
   *
   * @param changes Choices to replace.
   * @returns The updated display choices.
   */
  optionsUpdate(changes: Partial<EntityBrowserViewOptions>): EntityBrowserViewOptions {
    this.options = entityBrowserViewOptionsSanitize({ ...this.options, ...changes });
    this.persist();
    return this.options;
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
      const raw = this.storage?.getItem(ENTITY_BROWSER_SETTINGS_STORAGE_KEY) ?? null;
      return raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      return null;
    }
  }

  /** Writes the current choices; the storage skips writes while suppressed. */
  private persist(): void {
    try {
      this.storage?.setItem(ENTITY_BROWSER_SETTINGS_STORAGE_KEY, JSON.stringify(this.options));
    } catch {
      return;
    }
  }
}
