import { describe, it, expect } from 'vitest';
import { materialBrowserFilterEntries } from '@/texture/ui/material_browser/material_browser_filter.js';
import type { TextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';

/**
 * Proves the material filter keeps entries whose name or path contains every
 * typed word, ignoring case, and keeps everything for blank filters.
 */
describe('materialBrowserFilterEntries', () => {
  const brick = createEntry('walls/brick_red.png', 'brick_red');
  const floor = createEntry('floors/stone.png', 'stone');
  const metal = createEntry('walls/metal_plate.png', 'metal_plate');
  const entries = [brick, floor, metal];

  it('keeps every entry for an empty or blank filter in original order', () => {
    expect(materialBrowserFilterEntries(entries, '')).toEqual(entries);
    expect(materialBrowserFilterEntries(entries, '   ')).toEqual(entries);
  });

  it('matches display names case-insensitively', () => {
    expect(materialBrowserFilterEntries(entries, 'BRICK')).toEqual([brick]);
  });

  it('matches folder parts of the relative path', () => {
    expect(materialBrowserFilterEntries(entries, 'walls')).toEqual([brick, metal]);
  });

  it('requires every word to match', () => {
    expect(materialBrowserFilterEntries(entries, 'walls plate')).toEqual([metal]);
    expect(materialBrowserFilterEntries(entries, 'floors plate')).toEqual([]);
  });

  it('returns a new array that callers may change', () => {
    const result = materialBrowserFilterEntries(entries, '');
    result.pop();
    expect(entries).toHaveLength(3);
  });
});

/**
 * Creates a material entry for filter tests.
 *
 * @param relativePath Entry id and relative path.
 * @param displayName Name under the thumbnail.
 * @returns Material entry.
 */
function createEntry(relativePath: string, displayName: string): TextureBrowserEntry {
  const file = new File(['x'], `${displayName}.png`, { type: 'image/png' });
  return {
    id: relativePath,
    displayName,
    fileName: file.name,
    relativePath,
    previewObjectUrl: `blob:${displayName}`,
    mimeType: file.type,
    byteSize: file.size,
    sourceFile: file,
  };
}
