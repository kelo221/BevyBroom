import { describe, expect, it } from 'vitest';
import {
  FileTargetSceneDocument,
  isFileTargetHandle,
  type FileTargetHandle,
} from '@/io/dialog/file_target_scene_document.js';
import { FileTargetTestDiskFile } from './file_target_test_disk_file.js';

/**
 * Creates an in-memory writable file handle.
 *
 * @param name File name.
 * @param written Receives each completed write.
 * @returns Handle compatible with the File System Access API surface.
 */
function createMemoryHandle(name: string, written: string[]): FileTargetHandle {
  return {
    name,
    createWritable: async () => {
      let pending = '';
      return {
        write: async (data: string) => {
          pending += data;
        },
        close: async () => {
          written.push(pending);
        },
      };
    },
  };
}

/**
 * The scene document target lets repeated saves write the same file without a
 * picker.
 */
describe('FileTargetSceneDocument', () => {
  it('writes every save to the remembered file', async () => {
    const written: string[] = [];
    const target = new FileTargetSceneDocument();
    target.remember(createMemoryHandle('level.json', written));
    expect(await target.textWrite('first')).toBe('level.json');
    expect(await target.textWrite('second')).toBe('level.json');
    expect(written).toEqual(['first', 'second']);
  });

  it('reports no target before remembering and after forgetting', async () => {
    const target = new FileTargetSceneDocument();
    expect(target.hasTarget()).toBe(false);
    expect(await target.textWrite('lost')).toBeNull();
    target.remember(createMemoryHandle('level.json', []));
    target.forget();
    expect(target.fileNameRead()).toBeNull();
  });

  it('returns null when the remembered file cannot be written', async () => {
    const target = new FileTargetSceneDocument();
    target.remember({ name: 'locked.json', createWritable: async () => Promise.reject(new Error('denied')) });
    expect(await target.textWrite('data')).toBeNull();
  });

  it('recognizes only writable handles', () => {
    expect(isFileTargetHandle(createMemoryHandle('a.json', []))).toBe(true);
    expect(isFileTargetHandle({ name: 'a.json' })).toBe(false);
    expect(isFileTargetHandle(null)).toBe(false);
  });

  it('reports a file another program changed after the editor read it', async () => {
    const file = new FileTargetTestDiskFile('level.json', 'opened');
    const target = new FileTargetSceneDocument();
    target.remember(file.handleCreate(), file.lastModified);
    expect(await target.isChangedOnDisk()).toBe(false);
    file.externalEdit('edited elsewhere');
    expect(await target.isChangedOnDisk()).toBe(true);
  });

  it('counts its own save as the newest known version of the file', async () => {
    const file = new FileTargetTestDiskFile('level.json', 'opened');
    const target = new FileTargetSceneDocument();
    target.remember(file.handleCreate(), file.lastModified);
    file.externalEdit('edited elsewhere');
    expect(await target.textWrite('saved here')).toBe('level.json');
    expect(await target.isChangedOnDisk()).toBe(false);
    expect(file.contents).toBe('saved here');
  });

  it('never reports a change for a file it has not read or written', async () => {
    const file = new FileTargetTestDiskFile('level.json', 'unknown');
    const target = new FileTargetSceneDocument();
    target.remember(file.handleCreate());
    file.externalEdit('edited elsewhere');
    expect(await target.isChangedOnDisk()).toBe(false);
  });

  it('aborts a failed write so the file keeps its previous contents', async () => {
    const file = new FileTargetTestDiskFile('level.json', 'previous');
    const target = new FileTargetSceneDocument();
    target.remember(file.handleCreate(), file.lastModified);
    file.isWriteFailing = true;
    expect(await target.textWrite('lost')).toBeNull();
    expect(file.contents).toBe('previous');
    expect(file.abortCount).toBe(1);
  });
});
