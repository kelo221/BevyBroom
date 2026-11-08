import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ControllerTextureBrowser } from '@/texture/controller/controller_texture_browser.js';
import { MaterialBrowser } from '@/texture/ui/material_browser/material_browser.js';
import { TextureLibrary } from '@/texture/library/texture_library.js';
import { LocalDirectoryAccess, PickedDirectoryListing } from '@/texture/library/local_directory_access.js';
import { createTextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';
import {
  TEXTURE_LIBRARY_SOURCE_GAME_MATERIALS,
  TEXTURE_LIBRARY_SOURCE_LOCAL_FOLDER,
} from '@/texture/library/texture_library_source.js';
import { mockObjectUrlApis } from '../../texture/library/utils_object_url_test.js';

describe('ControllerTextureBrowser', () => {
  let host: HTMLElement;
  let browser: MaterialBrowser;
  let library: TextureLibrary;
  let directoryAccess: LocalDirectoryAccess;
  let controller: ControllerTextureBrowser;
  let statusMessages: string[];
  let selectionNames: Array<string | null>;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    mockObjectUrlApis('blob:ctrl');
    browser = new MaterialBrowser({
      onOpenFolder: () => {
        void controller.openFolder();
      },
      onSelectTexture: (entryId: string) => controller.selectTexture(entryId),
    });
    host.appendChild(browser.getElement());
    library = new TextureLibrary();
    directoryAccess = createMockDirectoryAccess(null);
    statusMessages = [];
    selectionNames = [];
    controller = new ControllerTextureBrowser({
      browser,
      library,
      directoryAccess,
    });
    controller.setStatusCallback((message) => statusMessages.push(message));
    controller.setSelectionCallback((entry) => {
      selectionNames.push(entry?.displayName ?? null);
    });
  });

  afterEach(() => {
    controller?.dispose();
    browser?.dispose();
    if (host.parentNode) host.parentNode.removeChild(host);
    vi.restoreAllMocks();
  });

  it('should load images from a picked folder into the library and UI', async () => {
    directoryAccess = createMockDirectoryAccess({
      folderName: 'Walls',
      files: [
        {
          name: 'brick.png',
          relativePath: 'brick.png',
          file: new File(['a'], 'brick.png', { type: 'image/png' }),
        },
        {
          name: 'notes.txt',
          relativePath: 'notes.txt',
          file: new File(['b'], 'notes.txt', { type: 'text/plain' }),
        },
      ],
    });
    controller.dispose();
    controller = new ControllerTextureBrowser({
      browser,
      library: new TextureLibrary(),
      directoryAccess,
    });
    controller.setStatusCallback((message) => statusMessages.push(message));
    controller.setSelectionCallback((entry) => {
      selectionNames.push(entry?.displayName ?? null);
    });
    await controller.openFolder();
    expect(controller.getLibrary().getEntryCount()).toBe(2);
    expect(controller.getLocalFolderName()).toBe('Walls');
    expect(host.textContent).toContain('Checker');
    expect(host.textContent).toContain('brick');
    expect(host.textContent).toContain('Folder: Walls');
    expect(statusMessages.some((message) => message.includes('Loaded 1'))).toBe(true);
  });

  it('should ignore cancelled folder picks without clearing existing data', async () => {
    const populatedLibrary = new TextureLibrary();
    const existingFile = new File(['x'], 'keep.png', { type: 'image/png' });
    populatedLibrary.replaceSource(TEXTURE_LIBRARY_SOURCE_LOCAL_FOLDER, [
      createTextureBrowserEntry(existingFile, 'keep.png', TEXTURE_LIBRARY_SOURCE_LOCAL_FOLDER),
    ]);
    directoryAccess = createMockDirectoryAccess(null);
    controller.dispose();
    controller = new ControllerTextureBrowser({
      browser,
      library: populatedLibrary,
      directoryAccess,
    });
    controller.refreshBrowserUi();
    await controller.openFolder();
    expect(controller.getLibrary().getEntryCount()).toBe(2);
    expect(host.textContent).toContain('2 texture(s)');
  });

  it('should select textures and notify the selection callback', async () => {
    directoryAccess = createMockDirectoryAccess({
      folderName: 'Pack',
      files: [
        {
          name: 'a.png',
          relativePath: 'a.png',
          file: new File(['a'], 'a.png', { type: 'image/png' }),
        },
        {
          name: 'b.png',
          relativePath: 'b.png',
          file: new File(['b'], 'b.png', { type: 'image/png' }),
        },
      ],
    });
    controller.dispose();
    controller = new ControllerTextureBrowser({
      browser,
      library: new TextureLibrary(),
      directoryAccess,
    });
    selectionNames = [];
    controller.setSelectionCallback((entry) => {
      selectionNames.push(entry?.displayName ?? null);
    });
    await controller.openFolder();
    controller.selectTexture('b.png');
    expect(controller.getLibrary().getSelectedId()).toBe('b.png');
    expect(selectionNames.at(-1)).toBe('b');
  });

  it('should keep game materials when a local folder is opened and drop only the cleared source', async () => {
    directoryAccess = createMockDirectoryAccess({
      folderName: 'Walls',
      files: [
        { name: 'brick.png', relativePath: 'brick.png', file: new File(['a'], 'brick.png', { type: 'image/png' }) },
      ],
    });
    controller.dispose();
    controller = new ControllerTextureBrowser({ browser, library: new TextureLibrary(), directoryAccess });
    const gameFile = new File(['g'], 'stone.png', { type: 'image/png' });
    controller.applyEntries(TEXTURE_LIBRARY_SOURCE_GAME_MATERIALS, [
      createTextureBrowserEntry(gameFile, 'castle/stone', TEXTURE_LIBRARY_SOURCE_GAME_MATERIALS),
    ]);
    await controller.openFolder();
    expect(controller.getLibrary().getEntryById('castle/stone')).not.toBeNull();
    expect(controller.getLibrary().getEntryById('brick.png')).not.toBeNull();
    const headers = Array.from(host.querySelectorAll<HTMLElement>('[data-source-header]')).map(
      (header) => header.dataset['sourceHeader'],
    );
    expect(headers.slice(-2)).toEqual([TEXTURE_LIBRARY_SOURCE_GAME_MATERIALS, TEXTURE_LIBRARY_SOURCE_LOCAL_FOLDER]);
    controller.clearSource(TEXTURE_LIBRARY_SOURCE_GAME_MATERIALS);
    expect(controller.getLibrary().getEntryById('castle/stone')).toBeNull();
    expect(controller.getLibrary().getEntryById('brick.png')).not.toBeNull();
    expect(host.querySelector('[data-entry-id="castle/stone"]')).toBeNull();
  });

  it('should report when folder access is unsupported', async () => {
    directoryAccess = {
      isSupported: () => false,
      pickDirectoryAndListFiles: async () => null,
    };
    controller.dispose();
    controller = new ControllerTextureBrowser({
      browser,
      library: new TextureLibrary(),
      directoryAccess,
    });
    statusMessages = [];
    controller.setStatusCallback((message) => statusMessages.push(message));
    await controller.openFolder();
    expect(statusMessages[0]).toMatch(/not supported/i);
  });
});

/**
 * Creates a mock LocalDirectoryAccess that returns a fixed listing.
 *
 * @param listing Listing or null for cancel.
 * @returns Mock access implementation.
 */
function createMockDirectoryAccess(listing: PickedDirectoryListing | null): LocalDirectoryAccess {
  return {
    isSupported: () => true,
    pickDirectoryAndListFiles: async () => listing,
  };
}
