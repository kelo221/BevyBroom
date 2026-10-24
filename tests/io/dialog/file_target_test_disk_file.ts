import type { FileTargetHandle } from '@/io/dialog/file_target_scene_document.js';

/**
 * In-memory file behaving like a File System Access file: a write replaces the
 * contents only when its stream closes, and every committed change gets a newer
 * modification time.
 */
export class FileTargetTestDiskFile {
  readonly name: string;
  contents: string;
  lastModified = 1;
  abortCount = 0;
  isWriteFailing = false;

  /**
   * Creates the file.
   *
   * @param name File name.
   * @param contents Initial contents.
   */
  constructor(name: string, contents: string = '') {
    this.name = name;
    this.contents = contents;
  }

  /**
   * Changes the file the way another program would.
   *
   * @param contents New contents.
   */
  externalEdit(contents: string): void {
    this.contentsCommit(contents);
  }

  /**
   * Returns a handle to the file.
   *
   * @returns File handle.
   */
  handleCreate(): FileTargetHandle {
    return {
      name: this.name,
      createWritable: async () => this.writableCreate(),
      getFile: async () => ({ lastModified: this.lastModified }),
    };
  }

  /**
   * Opens a write stream that commits on close.
   *
   * @returns Write stream.
   */
  private writableCreate() {
    let pending = '';
    return {
      write: async (data: string) => {
        if (this.isWriteFailing) throw new Error('disk full');
        pending += data;
      },
      close: async () => this.contentsCommit(pending),
      abort: async () => {
        this.abortCount += 1;
      },
    };
  }

  /**
   * Replaces the contents and makes the modification time newer.
   *
   * @param contents New contents.
   */
  private contentsCommit(contents: string): void {
    this.contents = contents;
    this.lastModified += 1;
  }
}
