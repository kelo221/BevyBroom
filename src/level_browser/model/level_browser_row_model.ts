import type { ProjectLevelSummary } from '@/project/level/project_level_types.js';

/** Label shown for a level whose document does not exist yet. */
export const LEVEL_BROWSER_MODIFIED_MISSING_LABEL = 'not saved yet';

/** One row of the Level Browser list. */
export interface LevelBrowserRow {
  /** Level the row shows. */
  level: ProjectLevelSummary;
  /** True for the level the open scene belongs to. */
  isOpen: boolean;
  /** Modification time as shown, such as "2026-11-12 14:05". */
  modifiedLabel: string;
  /** Secondary line: the level id and its document when they differ. */
  detailLabel: string;
}

/**
 * Builds the rows of the Level Browser: listed levels keep their file order
 * ahead of discovered documents, which the lister already sorted by path.
 *
 * @param levels Levels of the open project.
 * @param openDocument Document of the open level, or null when the scene
 *   belongs to no level.
 * @param searchText Text every shown row must contain in its name, id or
 *   document, compared without case; empty keeps every row.
 * @returns Rows in display order.
 */
export function levelBrowserRowsBuild(
  levels: readonly ProjectLevelSummary[],
  openDocument: string | null,
  searchText: string,
): LevelBrowserRow[] {
  const needle = searchText.trim().toLowerCase();
  return levels
    .filter((level) => needle === '' || levelBrowserSearchTextOf(level).includes(needle))
    .map((level) => ({
      level,
      isOpen: level.document === openDocument,
      modifiedLabel: levelBrowserModifiedLabelFormat(level.modifiedMilliseconds),
      detailLabel: levelBrowserDetailLabelFormat(level),
    }));
}

/**
 * Formats a modification time for the list.
 *
 * @param modifiedMilliseconds Milliseconds since the epoch, or null when the
 *   document does not exist.
 * @returns Local date and time without seconds, or the missing label.
 */
export function levelBrowserModifiedLabelFormat(modifiedMilliseconds: number | null): string {
  if (modifiedMilliseconds === null) {
    return LEVEL_BROWSER_MODIFIED_MISSING_LABEL;
  }
  const date = new Date(modifiedMilliseconds);
  const twoDigits = (value: number): string => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
  return `${day} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

/**
 * Formats the secondary line of a row: the level id, and the document when its
 * stem is not the id already.
 *
 * @param level Level of the row.
 * @returns Detail text.
 */
export function levelBrowserDetailLabelFormat(level: ProjectLevelSummary): string {
  const listedMark = level.isListed ? ' · listed in project' : '';
  return `${level.id} · ${level.document}${listedMark}`;
}

/**
 * Joins the searchable text of a level.
 *
 * @param level Level to search.
 * @returns Lowercase name, id and document.
 */
function levelBrowserSearchTextOf(level: ProjectLevelSummary): string {
  return `${level.name}\n${level.id}\n${level.document}`.toLowerCase();
}
