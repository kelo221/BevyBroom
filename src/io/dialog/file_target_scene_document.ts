/** Minimal writable stream surface of the File System Access API. */
interface FileTargetWritableStream {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

/** Minimal file handle surface of the File System Access API. */
export interface FileTargetHandle {
  readonly name: string;
  createWritable(): Promise<FileTargetWritableStream>;
}

/**
 * Remembers the file a scene document was opened from or last saved to, so
 * later saves write to the same file without showing a picker.
 */
export class FileTargetSceneDocument {
  private rememberedHandle: FileTargetHandle | null = null;

  /**
   * Remembers a file handle as the current scene document target.
   *
   * @param handle File handle returned by an open or save picker.
   */
  remember(handle: FileTargetHandle): void {
    this.rememberedHandle = handle;
  }

  /** Forgets the remembered target, so the next save shows a picker. */
  forget(): void {
    this.rememberedHandle = null;
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
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return handle.name;
    } catch {
      return null;
    }
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
