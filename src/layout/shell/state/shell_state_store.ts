import { areEditorStorageWritesSuppressed } from '@/settings/storage/clear_editor_storage.js';
import type { ShellState } from './shell_state.js';
import { shellStateSanitize } from './shell_state_sanitizer.js';

/** Storage key of the saved main window arrangement. */
export const SHELL_STATE_STORAGE_KEY = 'bevybroom.settings.shell';

/** Loads, updates and saves the main window arrangement. */
export class ShellStateStore {
  private readonly storage: Storage | null;
  private state: ShellState;

  /**
   * Creates a store and loads the saved arrangement.
   *
   * @param storage Browser storage, or null to keep the state in memory only.
   */
  constructor(storage: Storage | null = typeof localStorage !== 'undefined' ? localStorage : null) {
    this.storage = storage;
    this.state = shellStateSanitize(this.storageRead());
  }

  /**
   * Returns a copy of the current arrangement.
   *
   * @returns Shell state.
   */
  getState(): ShellState {
    return { ...this.state, splitSizesPx: { ...this.state.splitSizesPx } };
  }

  /**
   * Changes some fields and saves the result.
   *
   * @param changes Fields to replace.
   */
  update(changes: Partial<Omit<ShellState, 'splitSizesPx'>>): void {
    this.state = { ...this.state, ...changes };
    this.persist();
  }

  /**
   * Returns the saved size of an inner splitter.
   *
   * @param splitKey Splitter name.
   * @param fallbackPx Size used when nothing was saved.
   * @returns Size in CSS pixels.
   */
  splitSizeRead(splitKey: string, fallbackPx: number): number {
    return this.state.splitSizesPx[splitKey] ?? fallbackPx;
  }

  /**
   * Saves the size of an inner splitter.
   *
   * @param splitKey Splitter name.
   * @param sizePx Size in CSS pixels.
   */
  splitSizeWrite(splitKey: string, sizePx: number): void {
    this.state = { ...this.state, splitSizesPx: { ...this.state.splitSizesPx, [splitKey]: sizePx } };
    this.persist();
  }

  /**
   * Reads and parses the stored JSON.
   *
   * @returns Parsed value, or null when nothing valid is stored.
   */
  private storageRead(): unknown {
    if (!this.storage) {
      return null;
    }
    try {
      const raw = this.storage.getItem(SHELL_STATE_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      return null;
    }
  }

  /** Writes the current state unless storage writes are suppressed. */
  private persist(): void {
    if (!this.storage || areEditorStorageWritesSuppressed()) {
      return;
    }
    try {
      this.storage.setItem(SHELL_STATE_STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      return;
    }
  }
}
