import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MaterialBrowser } from '@/texture/ui/material_browser/material_browser.js';
import {
  MATERIAL_BROWSER_GRID_CLASS,
  MATERIAL_BROWSER_THUMB_CLASS,
} from '@/texture/ui/material_browser/material_browser_styles.js';
import type { TextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';

/**
 * Proves the docked material browser fills its parent, lists thumbnails,
 * filters them live, reports selection and opens folders.
 */
describe('MaterialBrowser', () => {
  let host: HTMLElement;
  let onOpenFolder: ReturnType<typeof vi.fn<() => void>>;
  let onSelectTexture: ReturnType<typeof vi.fn<(entryId: string) => void>>;
  let browser: MaterialBrowser;
  const brick = createEntry('walls/brick.png', 'brick');
  const stone = createEntry('floors/stone.png', 'stone');

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    onOpenFolder = vi.fn<() => void>();
    onSelectTexture = vi.fn<(entryId: string) => void>();
    browser = new MaterialBrowser({ onOpenFolder, onSelectTexture });
    host.appendChild(browser.getElement());
  });

  afterEach(() => {
    browser.dispose();
    host.remove();
  });

  it('fills its parent as a flexible column without window chrome', () => {
    const element = browser.getElement();
    expect(element.style.flex).toBe('1 1 auto');
    expect(element.style.minHeight).toBe('0px');
    expect(element.style.position).toBe('');
    expect(browser.getGridElement().classList.contains(MATERIAL_BROWSER_GRID_CLASS)).toBe(true);
    expect(browser.getGridElement().style.flex).toBe('1 1 auto');
  });

  it('shows the empty state before a folder is opened', () => {
    expect(host.textContent).toContain('Open a folder to browse textures');
    expect(host.textContent).toContain('No folder open');
  });

  it('lists every entry as a square thumbnail with its name', () => {
    browser.setEntries([brick, stone], brick.id, 'Pack');
    const thumbs = Array.from(host.querySelectorAll<HTMLElement>('[data-preview-thumb="true"]'));
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0]?.classList.contains(MATERIAL_BROWSER_THUMB_CLASS)).toBe(true);
    expect(thumbs[0]?.style.backgroundImage).toContain(brick.previewObjectUrl);
    expect(host.textContent).toContain('Folder: Pack');
    expect(host.textContent).toContain('2 texture(s)');
  });

  it('narrows the grid while typing in the filter field', () => {
    browser.setEntries([brick, stone], null, 'Pack');
    typeFilter('sto');
    expect(listedEntryIds()).toEqual([stone.id]);
    expect(host.textContent).toContain('1 of 2 texture(s)');
    typeFilter('');
    expect(listedEntryIds()).toEqual([brick.id, stone.id]);
  });

  it('keeps the filter when the library entries are replaced', () => {
    browser.setFilterText('walls');
    browser.setEntries([brick, stone], null, 'Pack');
    expect(listedEntryIds()).toEqual([brick.id]);
  });

  it('explains when nothing matches the filter', () => {
    browser.setEntries([brick, stone], null, 'Pack');
    browser.setFilterText('metal');
    expect(listedEntryIds()).toEqual([]);
    expect(host.textContent).toContain('No materials match the filter');
  });

  it('reports the clicked material and paints the selection', () => {
    browser.setEntries([brick, stone], brick.id, 'Pack');
    tile(stone.id).click();
    expect(onSelectTexture).toHaveBeenCalledWith(stone.id);
    browser.setSelectedId(stone.id);
    expect(tile(stone.id).getAttribute('aria-selected')).toBe('true');
    expect(tile(brick.id).getAttribute('aria-selected')).toBe('false');
  });

  it('selects with the keyboard', () => {
    browser.setEntries([brick], null, 'Pack');
    tile(brick.id).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onSelectTexture).toHaveBeenCalledWith(brick.id);
  });

  it('opens a folder from the filter row button', () => {
    const openButton = host.querySelector('button[aria-label="Open Folder"]');
    expect(openButton).toBeInstanceOf(HTMLButtonElement);
    (openButton as HTMLButtonElement).click();
    expect(onOpenFolder).toHaveBeenCalledTimes(1);
  });

  it('shows status messages from its controller', () => {
    browser.setStatusMessage('Opening folder…');
    expect(host.textContent).toContain('Opening folder…');
  });

  /**
   * Types text into the filter field.
   *
   * @param text Filter text.
   */
  function typeFilter(text: string): void {
    const input = host.querySelector('input[aria-label="Filter materials"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('Missing filter field');
    input.value = text;
    input.dispatchEvent(new Event('input'));
  }

  /**
   * Returns the ids of the listed tiles in grid order.
   *
   * @returns Entry ids.
   */
  function listedEntryIds(): string[] {
    return Array.from(host.querySelectorAll<HTMLElement>('[data-entry-id]')).map(
      (element) => element.dataset['entryId'] ?? '',
    );
  }

  /**
   * Returns the tile of an entry.
   *
   * @param entryId Entry id.
   * @returns Tile element.
   */
  function tile(entryId: string): HTMLElement {
    const element = host.querySelector(`[data-entry-id="${entryId}"]`);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing tile ${entryId}`);
    return element;
  }
});

/**
 * Creates a material entry with a fake preview URL.
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
