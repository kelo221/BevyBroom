import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { textFileOpenRpcHandlersCreate } from '@/desktop/bun/text_file/text_file_open_rpc_handlers.js';

describe('textFileOpenRpcHandlersCreate', () => {
  it('reads the first chosen file and passes the allowed types to the dialog', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'broom text file '));
    const filePath = join(directory, 'level one.scene.json');
    writeFileSync(filePath, '{"version":8}');
    const dialogShow = vi.fn(async () => ['', filePath]);
    const handlers = textFileOpenRpcHandlersCreate(dialogShow);
    const opened = await handlers.textFileOpen({ allowedFileTypes: 'json' });
    rmSync(directory, { recursive: true, force: true });
    expect(dialogShow).toHaveBeenCalledWith('json');
    expect(opened).toEqual({ path: filePath, fileName: 'level one.scene.json', text: '{"version":8}' });
  });

  it('returns null and reads nothing when the dialog is cancelled', async () => {
    const reader = vi.fn(async () => 'unused');
    const handlers = textFileOpenRpcHandlersCreate(async () => [''], reader);
    expect(await handlers.textFileOpen({ allowedFileTypes: '*' })).toBeNull();
    expect(reader).not.toHaveBeenCalled();
  });
});
