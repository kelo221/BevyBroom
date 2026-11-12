import { afterEach, describe, expect, it, vi } from 'vitest';
import { ManagerFileDialog } from '@/io/dialog/manager_file_dialog.js';
import {
  fileDialogDesktopAllowedFileTypesFromAccept,
  fileDialogDesktopBridgeResolve,
} from '@/io/dialog/desktop/file_dialog_desktop_bridge.js';

/** Scene text returned by the fake native dialog. */
const FILE_DIALOG_DESKTOP_TEST_SCENE = JSON.stringify({ version: 8, objects: [] });

/**
 * Installs a fake desktop bridge that answers with a file or a cancel.
 *
 * @param isCancelled Whether the fake dialog is cancelled.
 * @returns Spy of the native open request.
 */
function fileDialogDesktopTestBridgeInstall(isCancelled: boolean) {
  const textFileOpen = vi.fn(async () =>
    isCancelled
      ? null
      : { path: '/levels/store.scene.json', fileName: 'store.scene.json', text: FILE_DIALOG_DESKTOP_TEST_SCENE },
  );
  window.bevybroomFileDialogDesktop = { textFileOpen };
  return textFileOpen;
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

  it('loads a scene through the native dialog without clicking a hidden file input', async () => {
    const textFileOpen = fileDialogDesktopTestBridgeInstall(false);
    const inputClick = vi.spyOn(HTMLInputElement.prototype, 'click');
    const text = await new ManagerFileDialog().loadSceneDocument();
    expect(text).toBe(FILE_DIALOG_DESKTOP_TEST_SCENE);
    expect(textFileOpen).toHaveBeenCalledWith({ allowedFileTypes: 'json' });
    expect(inputClick).not.toHaveBeenCalled();
  });

  it('returns null when the native dialog is cancelled', async () => {
    fileDialogDesktopTestBridgeInstall(true);
    expect(await new ManagerFileDialog().loadSceneDocument()).toBeNull();
    expect(await new ManagerFileDialog().loadTextFile('.vmf', 'VMF', ['.vmf'])).toBeNull();
  });
});
