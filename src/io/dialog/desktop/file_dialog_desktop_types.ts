/** Text file chosen in the native open dialog of the desktop app. */
export interface FileDialogDesktopTextFile {
  /** Absolute path of the chosen file. */
  readonly path: string;
  /** File name without folders. */
  readonly fileName: string;
  /** Text content of the file. */
  readonly text: string;
  /** Modification time of the file in milliseconds. */
  readonly lastModified: number;
}

/** Request of the native open dialog. */
export interface FileDialogDesktopTextFileOpenParams {
  /**
   * Allowed extensions without dots, comma separated, such as "json" or
   * "vmf,txt"; "*" allows any file.
   */
  readonly allowedFileTypes: string;
}

/** Request of the native save dialog. */
export interface FileDialogDesktopSavePickParams {
  /** File name the dialog suggests. */
  readonly suggestedName: string;
  /** Extension without dot added when the chosen name has none, such as "json". */
  readonly defaultExtension: string;
}

/** Request to write a whole text file. */
export interface FileDialogDesktopTextFileWriteParams {
  /** Absolute path of the file. */
  readonly path: string;
  /** Complete file contents. */
  readonly text: string;
}

/** Request to read the modification time of a file. */
export interface FileDialogDesktopFileStatParams {
  /** Absolute path of the file. */
  readonly path: string;
}

/** Modification time of a file. */
export interface FileDialogDesktopFileStat {
  /** Modification time in milliseconds. */
  readonly lastModified: number;
}
