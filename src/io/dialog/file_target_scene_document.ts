/** Minimal writable stream surface of the File System Access API. */
interface FileTargetWritableStream {
  write(data: string): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}

/** Minimal file handle surface of the File System Access API. */
export interface FileTargetHandle {
  readonly name: string;
  createWritable(): Promise<FileTargetWritableStream>;
  getFile?(): Promise<{ readonly lastModified: number }>;
}

/**
 * Remembers the file a scene document was opened from or last saved to, so
 * later saves write to the same file without showing a picker, and tells
 * whether another program changed that file since.
 */
export class FileTargetSceneDocument {
  private rememberedHandle: FileTargetHandle | null = null;
  private knownLastModified: number | null = null;

  /**
   * Remembers a file handle as the current scene document target.
   *
   * @param handle File handle returned by an open or save picker.
   * @param knownLastModified Modification time of the file as the editor read
   *   it, or null when the editor has not read it.
   */
  remember(handle: FileTargetHandle, knownLastModified: number | null = null): void {
    this.rememberedHandle = handle;
    this.knownLastModified = knownLastModified;
  }

  /** Forgets the remembered target, so the next save shows a picker. */
  forget(): void {
    this.rememberedHandle = null;
    this.knownLastModified = null;
  }

  /**
   * Returns whether the remembered file was modified after the editor last read
   * or wrote it.
   *
   * @returns True when the file on disk is newer than the editor's copy.
   */
  async isChangedOnDisk(): Promise<boolean> {
    const handle = this.rememberedHandle;
    if (handle === null || this.knownLastModified === null) {
      return false;
    }
    const currentLastModified = await fileTargetLastModifiedRead(handle);
    return currentLastModified !== null && currentLastModified > this.knownLastModified;
  }

  /**
   * Returns whether a target file is remembered.
   *
   * @returns True when a later save can write without a picker.
   */
  hasTarget(): boolean {
    return this.rememberedHandle !== null;
  }

  /**
   * Returns the remembered file name.
   *
   * @returns The file name, or null when nothing is remembered.
   */
  fileNameRead(): string | null {
    return this.rememberedHandle?.name ?? null;
  }

  /**
   * Writes text to the remembered file, replacing its contents.
   *
   * @param text Complete file contents.
   * @returns The written file name, or null when nothing is remembered or the
   *   write failed.
   */
  async textWrite(text: string): Promise<string | null> {
    const handle = this.rememberedHandle;
    if (handle === null) {
      return null;
    }
    try {
      await fileTargetTextWriteAtomically(handle, text);
      this.knownLastModified = await fileTargetLastModifiedRead(handle);
      return handle.name;
    } catch {
      return null;
    }
  }
}

/**
 * Writes text through a writable stream, which replaces the file only when the
 * stream closes; a failed write is aborted so the old file stays as it was.
 *
 * @param handle File to write.
 * @param text Complete file contents.
 */
async function fileTargetTextWriteAtomically(handle: FileTargetHandle, text: string): Promise<void> {
  const writable = await handle.createWritable();
  try {
    await writable.write(text);
    await writable.close();
  } catch (error) {
    await writable.abort?.().catch(() => undefined);
    throw error;
  }
}

/**
 * Reads a file's modification time.
 *
 * @param handle File to inspect.
 * @returns Modification time in milliseconds, or null when it cannot be read.
 */
async function fileTargetLastModifiedRead(handle: FileTargetHandle): Promise<number | null> {
  try {
    return handle.getFile === undefined ? null : (await handle.getFile()).lastModified;
  } catch {
    return null;
  }
}

/**
 * Returns whether a value looks like a writable File System Access file handle.
 *
 * @param value Candidate value returned by a picker.
 * @returns True when the value can be remembered as a scene document target.
 */
export function isFileTargetHandle(value: unknown): value is FileTargetHandle {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { name?: unknown; createWritable?: unknown };
  return typeof candidate.name === 'string' && typeof candidate.createWritable === 'function';
}
