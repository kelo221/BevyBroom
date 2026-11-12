/** Text file chosen in the native open dialog of the desktop app. */
export interface FileDialogDesktopTextFile {
  /** Absolute path of the chosen file. */
  readonly path: string;
  /** File name without folders. */
  readonly fileName: string;
  /** Text content of the file. */
  readonly text: string;
}

/** Request of the native open dialog. */
export interface FileDialogDesktopTextFileOpenParams {
  /**
   * Allowed extensions without dots, comma separated, such as "json" or
   * "vmf,txt"; "*" allows any file.
   */
  readonly allowedFileTypes: string;
}
