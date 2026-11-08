import { TextureBrowserEntry, revokeTextureBrowserEntry } from './texture_browser_entry.js';
import { getDefaultCheckerBrowserEntry, isBuiltinCheckerEntry } from './default_checker_entry.js';
import { DEFAULT_CHECKER_TEXTURE_ID } from './texture_id.js';
import { textureLibrarySourceRank } from './texture_library_source.js';

/**
 * In-memory catalog of textures for the texture browser, grouped into named
 * sources. Always includes the built-in checker as the first entry. Owns the
 * object URL lifetimes of every source entry.
 */
export class TextureLibrary {
  private readonly sourceEntries: Map<string, TextureBrowserEntry[]>;
  private mergedEntries: TextureBrowserEntry[] | null;
  private mergedEntriesById: Map<string, TextureBrowserEntry>;
  private selectedId: string;

  /** Creates a library containing only the built-in checker. */
  constructor() {
    this.sourceEntries = new Map();
    this.mergedEntries = null;
    this.mergedEntriesById = new Map();
    this.selectedId = DEFAULT_CHECKER_TEXTURE_ID;
  }

  /**
   * Replaces the textures of one source. Previous URLs of that source are
   * revoked; other sources stay untouched.
   *
   * @param sourceName Name of the texture source.
   * @param entries New entries of the source (the checker is ignored).
   */
  replaceSource(sourceName: string, entries: TextureBrowserEntry[]): void {
    this.sourceEntriesRevoke(sourceName);
    this.sourceEntries.set(
      sourceName,
      entries.filter((entry) => !isBuiltinCheckerEntry(entry)),
    );
    this.mergedEntriesInvalidate();
  }

  /**
   * Removes every texture of one source and revokes its URLs.
   *
   * @param sourceName Name of the texture source.
   */
  clearSource(sourceName: string): void {
    this.sourceEntriesRevoke(sourceName);
    this.sourceEntries.delete(sourceName);
    this.mergedEntriesInvalidate();
  }

  /** Removes every source, revokes their URLs and selects the checker. */
  clearAllSources(): void {
    Array.from(this.sourceEntries.keys()).forEach((sourceName) => this.clearSource(sourceName));
    this.selectedId = DEFAULT_CHECKER_TEXTURE_ID;
  }

  /**
   * Returns browser entries: the checker first, then every source in source
   * order; an id already listed by an earlier source is skipped.
   *
   * @returns Texture entries including the built-in checker.
   */
  getEntries(): TextureBrowserEntry[] {
    return this.mergedEntriesRead().slice();
  }

  /**
   * Returns the number of textures shown in the browser (includes checker).
   *
   * @returns Entry count.
   */
  getEntryCount(): number {
    return this.mergedEntriesRead().length;
  }

  /**
   * Returns the currently selected entry id.
   *
   * @returns Selected id (defaults to checker).
   */
  getSelectedId(): string {
    return this.selectedId;
  }

  /**
   * Returns the currently selected entry.
   *
   * @returns Selected entry (checker when nothing else selected).
   */
  getSelectedEntry(): TextureBrowserEntry {
    return this.getEntryById(this.selectedId) ?? getDefaultCheckerBrowserEntry();
  }

  /**
   * Selects a texture by id.
   *
   * @param id Entry id to select.
   * @returns True when the id exists and was selected.
   */
  selectById(id: string): boolean {
    if (!this.getEntryById(id)) return false;
    this.selectedId = id;
    return true;
  }

  /**
   * Finds the shown entry of an id (checker or the first source holding it).
   *
   * @param id Entry id.
   * @returns Entry or null.
   */
  getEntryById(id: string): TextureBrowserEntry | null {
    this.mergedEntriesRead();
    return this.mergedEntriesById.get(id) ?? null;
  }

  /**
   * Returns the merged entry list, building it after a source changed.
   *
   * @returns Merged entries owned by the library.
   */
  private mergedEntriesRead(): TextureBrowserEntry[] {
    if (this.mergedEntries === null) {
      this.mergedEntriesRebuild();
    }
    return this.mergedEntries ?? [];
  }

  /** Builds the merged list and its id lookup, first source winning on ids. */
  private mergedEntriesRebuild(): void {
    const checker = getDefaultCheckerBrowserEntry();
    const byId = new Map<string, TextureBrowserEntry>([[checker.id, checker]]);
    const merged = [checker];
    this.sourceNamesOrdered().forEach((sourceName) => {
      (this.sourceEntries.get(sourceName) ?? []).forEach((entry) => {
        if (!byId.has(entry.id)) {
          byId.set(entry.id, entry);
          merged.push(entry);
        }
      });
    });
    this.mergedEntries = merged;
    this.mergedEntriesById = byId;
  }

  /** Drops the merged list and selects the checker when the selection is gone. */
  private mergedEntriesInvalidate(): void {
    this.mergedEntries = null;
    if (!this.getEntryById(this.selectedId)) {
      this.selectedId = DEFAULT_CHECKER_TEXTURE_ID;
    }
  }

  /**
   * Returns every stored source name in source order, unknown sources in the
   * order they were added.
   *
   * @returns Source names.
   */
  private sourceNamesOrdered(): string[] {
    return Array.from(this.sourceEntries.keys()).sort(
      (first, second) => textureLibrarySourceRank(first) - textureLibrarySourceRank(second),
    );
  }

  /**
   * Revokes the object URLs of one source.
   *
   * @param sourceName Name of the texture source.
   */
  private sourceEntriesRevoke(sourceName: string): void {
    (this.sourceEntries.get(sourceName) ?? []).forEach((entry) => revokeTextureBrowserEntry(entry));
  }
}
