import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  textFileRpcHandlersCreate,
  textFileRpcServicesDiskCreate,
} from '@/desktop/bun/text_file/text_file_rpc_handlers.js';

/** Temporary folders created by the tests. */
const textFileTestDirectories: string[] = [];

/**
 * Creates a temporary folder with spaces in its name.
 *
 * @returns Folder path.
 */
function textFileTestDirectoryCreate(): string {
  const directory = mkdtempSync(join(tmpdir(), 'broom text file '));
  textFileTestDirectories.push(directory);
  return directory;
}

describe('textFileRpcHandlersCreate', () => {
  afterEach(() => {
    textFileTestDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
  });

  it('opens the first chosen file with its text and modification time', async () => {
    const filePath = join(textFileTestDirectoryCreate(), 'level one.scene.json');
    writeFileSync(filePath, '{"version":8}');
    const openDialogShow = vi.fn(async () => ['', filePath]);
    const handlers = textFileRpcHandlersCreate(
      textFileRpcServicesDiskCreate({ openDialogShow, savePanelShow: vi.fn() }),
    );
    const opened = await handlers.textFileOpen({ allowedFileTypes: 'json' });
    expect(openDialogShow).toHaveBeenCalledWith('json');
    expect(opened).toMatchObject({ path: filePath, fileName: 'level one.scene.json', text: '{"version":8}' });
    expect(opened?.lastModified).toBeGreaterThan(0);
  });

  it('replaces a file atomically, leaves no temporary file and reports the new time', async () => {
    const directory = textFileTestDirectoryCreate();
    const filePath = join(directory, 'store.json');
    writeFileSync(filePath, 'old');
    const handlers = textFileRpcHandlersCreate(
      textFileRpcServicesDiskCreate({ openDialogShow: vi.fn(), savePanelShow: vi.fn() }),
    );
    const written = await handlers.textFileWrite({ path: filePath, text: 'new' });
    expect(readFileSync(filePath, 'utf8')).toBe('new');
    expect(readdirSync(directory)).toEqual(['store.json']);
    expect(await handlers.fileStat({ path: filePath })).toEqual(written);
    expect(await handlers.fileStat({ path: join(directory, 'missing.json') })).toBeNull();
  });

  it('returns null and reads nothing when the open dialog is cancelled', async () => {
    const textRead = vi.fn(async () => 'unused');
    const handlers = textFileRpcHandlersCreate({
      ...textFileRpcServicesDiskCreate({ openDialogShow: async () => [''], savePanelShow: async () => null }),
      textRead,
    });
    expect(await handlers.textFileOpen({ allowedFileTypes: '*' })).toBeNull();
    expect(await handlers.savePathPick({ suggestedName: 'a.json', defaultExtension: 'json' })).toBeNull();
    expect(textRead).not.toHaveBeenCalled();
  });
});
