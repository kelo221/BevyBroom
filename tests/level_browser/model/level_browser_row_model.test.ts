import { describe, expect, it } from 'vitest';
import {
  LEVEL_BROWSER_MODIFIED_MISSING_LABEL,
  levelBrowserDetailLabelFormat,
  levelBrowserModifiedLabelFormat,
  levelBrowserRowsBuild,
} from '@/level_browser/model/level_browser_row_model.js';
import type { ProjectLevelSummary } from '@/project/level/project_level_types.js';

/**
 * Builds a level summary.
 *
 * @param document Document path.
 * @param isListed True when the project file lists it.
 * @returns Level summary with an id from its stem.
 */
function levelCreate(document: string, isListed: boolean): ProjectLevelSummary {
  const stem = document.replace(/\.json$/, '');
  return { id: stem, name: stem.replace(/_/g, ' '), document, modifiedMilliseconds: 1_700_000_000_000, isListed };
}

/** The row model turns level summaries into what the Level Browser shows. */
describe('levelBrowserRowsBuild', () => {
  it('keeps the level order, marks the open level and filters by name, id or document', () => {
    const levels = [levelCreate('zeta.json', true), levelCreate('alpha_hall.json', false)];
    const rows = levelBrowserRowsBuild(levels, 'alpha_hall.json', '');
    expect(rows.map((row) => [row.level.document, row.isOpen])).toEqual([
      ['zeta.json', false],
      ['alpha_hall.json', true],
    ]);
    expect(levelBrowserRowsBuild(levels, null, 'HALL').map((row) => row.level.document)).toEqual(['alpha_hall.json']);
    expect(levelBrowserRowsBuild(levels, null, 'zeta.js').map((row) => row.level.document)).toEqual(['zeta.json']);
    expect(levelBrowserRowsBuild(levels, null, 'nothing')).toEqual([]);
  });

  it('formats the modified time as a local date without seconds and names missing documents', () => {
    const date = new Date(2026, 10, 12, 9, 5, 59);
    expect(levelBrowserModifiedLabelFormat(date.getTime())).toBe('2026-11-12 09:05');
    expect(levelBrowserModifiedLabelFormat(null)).toBe(LEVEL_BROWSER_MODIFIED_MISSING_LABEL);
  });

  it('describes a row with its id and document and marks levels listed in the project file', () => {
    expect(levelBrowserDetailLabelFormat(levelCreate('arenas/pit.json', false))).toBe('arenas/pit · arenas/pit.json');
    expect(levelBrowserDetailLabelFormat(levelCreate('hall.json', true))).toBe('hall · hall.json · listed in project');
  });
});
