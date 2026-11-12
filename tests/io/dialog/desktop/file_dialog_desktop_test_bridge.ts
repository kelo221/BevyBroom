import { vi } from 'vitest';
import type { FileDialogDesktopBridge } from '@/io/dialog/desktop/file_dialog_desktop_bridge.js';
import type { FileDialogDesktopFileStat } from '@/io/dialog/desktop/file_dialog_desktop_types.js';

/** Desktop file bridge over an in-memory disk with scripted dialog answers. */
export class FileDialogDesktopTestBridge implements FileDialogDesktopBridge {
  /** File contents by absolute path. */
  readonly files = new Map<string, string>();
  /** Modification times by absolute path. */
  readonly modified = new Map<string, number>();
  /** Path the open dialog answers with, or null to cancel. */
  openAnswer: string | null = null;
  /** Path the save dialog answers with, or null to cancel. */
  saveAnswer: string | null = null;
  private clock = 1000;

  readonly textFileOpen = vi.fn(async () => {
    const path = this.openAnswer;
    if (path === null) {
      return null;
    }
    const text = this.files.get(path) ?? '';
    const fileName = path.split('/').pop() ?? path;
    return { path, fileName, text, lastModified: this.modified.get(path) ?? 0 };
  });

  readonly savePathPick = vi.fn(async () => this.saveAnswer);

  readonly textFileWrite = vi.fn(async ({ path, text }: { path: string; text: string }) => {
    this.fileSet(path, text);
    return { lastModified: this.modified.get(path) ?? 0 };
  });

  readonly fileStat = vi.fn(async ({ path }: { path: string }): Promise<FileDialogDesktopFileStat | null> => {
    const lastModified = this.modified.get(path);
    return lastModified === undefined ? null : { lastModified };
  });

  /**
   * Writes a file as another program would, with a newer modification time.
   *
   * @param path Absolute path.
   * @param text File contents.
   */
  fileSet(path: string, text: string): void {
    this.clock += 1000;
    this.files.set(path, text);
    this.modified.set(path, this.clock);
  }
}
