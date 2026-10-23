import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MaterialBrowser } from '@/texture/ui/material_browser/material_browser.js';
import { createTextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';
import type { TextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';
import type { MaterialBrowserContextActions } from '@/texture/ui/material_browser/material_browser.js';
import { mockObjectUrlApis } from '../../library/utils_object_url_test.js';

describe('MaterialBrowser context menu', () => {
  let host: HTMLElement;
  let actions: {
    onSelectFacesUsingMaterial: ReturnType<typeof vi.fn<MaterialBrowserContextActions['onSelectFacesUsingMaterial']>>;
    onSelectObjectsUsingMaterial: ReturnType<
      typeof vi.fn<MaterialBrowserContextActions['onSelectObjectsUsingMaterial']>
    >;
    onCopyName: ReturnType<typeof vi.fn<MaterialBrowserContextActions['onCopyName']>>;
  };
  let browser: MaterialBrowser;
  let entry: TextureBrowserEntry;

  beforeEach(() => {
    mockObjectUrlApis('blob:browser-menu');
    host = document.createElement('div');
    document.body.appendChild(host);
    actions = {
      onSelectFacesUsingMaterial: vi.fn(),
      onSelectObjectsUsingMaterial: vi.fn(),
      onCopyName: vi.fn(),
    };
    entry = createTextureBrowserEntry(new File(['x'], 'brick.png', { type: 'image/png' }), 'walls/brick.png');
    browser = new MaterialBrowser({
      onOpenFolder: () => undefined,
      onSelectTexture: () => undefined,
      contextActions: actions,
    });
    browser.setEntries([entry], entry.id, 'walls');
    host.appendChild(browser.getElement());
  });

  afterEach(() => {
    browser.dispose();
    host.remove();
    vi.restoreAllMocks();
  });

  it('offers the three material usage actions on tile right click', () => {
    dispatchContextMenu(entry.id);
    const labels = openMenuLabels();
    expect(labels).toContain('Select Faces Using This Material');
    expect(labels).toContain('Select Brushes/Objects Using This Material');
    expect(labels).toContain('Copy Name');
  });

  it('runs the faces action for the right-clicked material', () => {
    dispatchContextMenu(entry.id);
    clickMenuItem('Select Faces Using This Material');
    expect(actions.onSelectFacesUsingMaterial).toHaveBeenCalledWith(entry);
    expect(actions.onSelectObjectsUsingMaterial).not.toHaveBeenCalled();
  });

  it('runs the copy name action for the right-clicked material', () => {
    dispatchContextMenu(entry.id);
    clickMenuItem('Copy Name');
    expect(actions.onCopyName).toHaveBeenCalledWith(entry);
  });
});

/**
 * Dispatches a right click on one material tile.
 *
 * @param entryId Entry id of the tile.
 */
function dispatchContextMenu(entryId: string): void {
  const tile = document.querySelector<HTMLElement>(`[data-entry-id="${entryId}"]` as string);
  if (!tile) {
    throw new Error('tile not found');
  }
  tile.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
}

/**
 * Reads the labels of the open menu panel.
 *
 * @returns Visible menu row labels.
 */
function openMenuLabels(): string[] {
  return Array.from(document.querySelectorAll('.editor-toolbar-dropdown-menu button'))
    .map((button) => button.textContent?.trim() ?? '')
    .filter((label) => label.length > 0);
}

/**
 * Clicks one open menu row by label.
 *
 * @param label Row label.
 */
function clickMenuItem(label: string): void {
  const row = Array.from(document.querySelectorAll<HTMLButtonElement>('.editor-toolbar-dropdown-menu button')).find(
    (button) => button.textContent?.trim() === label,
  );
  if (!row) {
    throw new Error(`menu row not found: ${label}`);
  }
  row.click();
}
