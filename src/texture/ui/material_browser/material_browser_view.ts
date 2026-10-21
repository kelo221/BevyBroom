import type { TextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';

/** View that lists the material library and shows its selection and status. */
export interface MaterialBrowserView {
  /**
   * Replaces the listed materials.
   *
   * @param entries Materials to list.
   * @param selectedId Currently selected entry id, or null.
   * @param folderName Opened folder name, or null.
   */
  setEntries(entries: TextureBrowserEntry[], selectedId: string | null, folderName: string | null): void;

  /**
   * Highlights the selected material without rebuilding the list.
   *
   * @param selectedId Entry id to highlight, or null.
   */
  setSelectedId(selectedId: string | null): void;

  /**
   * Shows a status message such as loading or error text.
   *
   * @param message Status text.
   */
  setStatusMessage(message: string): void;
}
