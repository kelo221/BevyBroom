import { afterEach, describe, expect, it, vi } from 'vitest';
import { ManagerFileDialog } from '@/io/dialog/manager_file_dialog.js';
import {
  fileDialogDesktopAllowedFileTypesFromAccept,
  fileDialogDesktopBridgeResolve,
} from '@/io/dialog/desktop/file_dialog_desktop_bridge.js';
import { FileDialogDesktopTestBridge } from './file_dialog_desktop_test_bridge.js';

/** Scene file on the fake desktop disk. */
const DESKTOP_TEST_SCENE_PATH = '/levels/store.scene.json';

/**
 * Installs a fake desktop bridge holding one scene file.
 *
 * @returns Fake bridge.
 */
function desktopTestBridgeInstall(): FileDialogDesktopTestBridge {
  const bridge = new FileDialogDesktopTestBridge();
  bridge.fileSet(DESKTOP_TEST_SCENE_PATH, JSON.stringify({ version: 8, objects: [] }));
  window.bevybroomFileDialogDesktop = bridge;
  return bridge;
}

describe('desktop file dialog bridge', () => {
  afterEach(() => {
    delete window.bevybroomFileDialogDesktop;
    vi.restoreAllMocks();
  });

  it('turns input accept strings into native extension lists', () => {
    expect(fileDialogDesktopAllowedFileTypesFromAccept('.json')).toBe('json');
    expect(fileDialogDesktopAllowedFileTypesFromAccept('.VMF, text/plain, .vmf, .txt')).toBe('vmf,txt');
    expect(fileDialogDesktopAllowedFileTypesFromAccept('text/plain')).toBe('*');
  });

  it('is absent in a plain browser page', () => {
    expect(fileDialogDesktopBridgeResolve()).toBeNull();
  });

  it('loads through the native dialog and saves back to the same file without asking', async () => {
    const bridge = desktopTestBridgeInstall();
    bridge.openAnswer = DESKTOP_TEST_SCENE_PATH;
    const inputClick = vi.spyOn(HTMLInputElement.prototype, 'click');
    const manager = new ManagerFileDialog();
    const loaded = await manager.loadSceneDocument();
    expect(loaded).toBe(bridge.files.get(DESKTOP_TEST_SCENE_PATH));
    expect(inputClick).not.toHaveBeenCalled();
    const edited = JSON.stringify({ version: 8, objects: [{ name: 'Shelf moved' }] });
    expect(await manager.saveSceneDocument(edited, 'ignored.json')).toBe('store.scene.json');
    expect(bridge.files.get(DESKTOP_TEST_SCENE_PATH)).toBe(edited);
    expect(bridge.savePathPick).not.toHaveBeenCalled();
  });

  it('notices when another program changed the opened file', async () => {
    const bridge = desktopTestBridgeInstall();
    bridge.openAnswer = DESKTOP_TEST_SCENE_PATH;
    const manager = new ManagerFileDialog();
    await manager.loadSceneDocument();
    expect(await manager.sceneDocumentChangedOnDiskIs()).toBe(false);
    bridge.fileSet(DESKTOP_TEST_SCENE_PATH, '{}');
    expect(await manager.sceneDocumentChangedOnDiskIs()).toBe(true);
  });

  it('asks for a path on first save, writes there and remembers it', async () => {
    const bridge = desktopTestBridgeInstall();
    bridge.saveAnswer = '/levels/new level.json';
    const manager = new ManagerFileDialog();
    expect(await manager.saveSceneDocument('{"a":1}', 'scene.json')).toBe('new level.json');
    expect(bridge.savePathPick).toHaveBeenCalledWith({ suggestedName: 'scene.json', defaultExtension: 'json' });
    await manager.saveSceneDocument('{"a":2}', 'scene.json');
    expect(bridge.savePathPick).toHaveBeenCalledTimes(1);
    expect(bridge.files.get('/levels/new level.json')).toBe('{"a":2}');
  });

  it('returns null and writes nothing when the dialogs are cancelled', async () => {
    const bridge = desktopTestBridgeInstall();
    const manager = new ManagerFileDialog();
    expect(await manager.loadSceneDocument()).toBeNull();
    expect(await manager.saveSceneDocumentAs('{}', 'scene.json')).toBeNull();
    expect(await manager.loadTextFile('.vmf', 'VMF', ['.vmf'])).toBeNull();
    expect(bridge.textFileWrite).not.toHaveBeenCalled();
  });
});
