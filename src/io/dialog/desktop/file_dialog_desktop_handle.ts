import type { FileTargetHandle } from '@/io/dialog/file_target_scene_document.js';
import type { FileDialogDesktopBridge } from '@/io/dialog/desktop/file_dialog_desktop_bridge.js';

/** Collects written text and replaces the desktop file when closed. */
class FileDialogDesktopWritable {
  private readonly bridge: FileDialogDesktopBridge;
  private readonly path: string;
  private collectedText = '';

  /**
   * Creates the writable.
   *
   * @param bridge Desktop file access.
   * @param path Absolute path of the file.
   */
  constructor(bridge: FileDialogDesktopBridge, path: string) {
    this.bridge = bridge;
    this.path = path;
  }

  /**
   * Collects text to write.
   *
   * @param data Text appended to the pending contents.
   */
  async write(data: string): Promise<void> {
    this.collectedText += data;
  }

  /** Replaces the file with the collected text. */
  async close(): Promise<void> {
    await this.bridge.textFileWrite({ path: this.path, text: this.collectedText });
  }

  /** Drops the collected text without touching the file. */
  async abort(): Promise<void> {
    this.collectedText = '';
  }
}

/**
 * File handle of a file on the desktop's disk, shaped like a File System Access
 * handle so remembered scene targets work the same in the desktop app.
 */
export class FileDialogDesktopHandle implements FileTargetHandle {
  readonly name: string;
  private readonly bridge: FileDialogDesktopBridge;
  private readonly path: string;

  /**
   * Creates the handle.
   *
   * @param bridge Desktop file access.
   * @param path Absolute path of the file.
   */
  constructor(bridge: FileDialogDesktopBridge, path: string) {
    this.bridge = bridge;
    this.path = path;
    this.name = path.split(/[\\/]/).pop() ?? path;
  }

  /**
   * Returns the absolute path of the file.
   *
   * @returns File path.
   */
  pathRead(): string {
    return this.path;
  }

  /**
   * Opens a writable that replaces the file when closed.
   *
   * @returns Writable stream.
   */
  async createWritable(): Promise<FileDialogDesktopWritable> {
    return new FileDialogDesktopWritable(this.bridge, this.path);
  }

  /**
   * Reads the modification time of the file.
   *
   * @returns Modification time, zero when the file is missing.
   */
  async getFile(): Promise<{ readonly lastModified: number }> {
    const stat = await this.bridge.fileStat({ path: this.path });
    return { lastModified: stat?.lastModified ?? 0 };
  }
}
