/**
 * Kinds of editor data a project keeps in its own files: the game entity
 * classes every level shares, and the prefabs every level can place.
 */
export type ProjectDataFileKind = 'entity_classes' | 'prefabs';

/** One project data file: its name inside its directory and its text. */
export interface ProjectDataFile {
  /** File name without directories, such as "shelf_row.json". */
  name: string;
  /** File text. */
  text: string;
}

/**
 * Every file of one kind of project data. `isConfigured` is false when the
 * project file names no location for the kind, so nothing is read or written.
 * `fixedFileName` names the only file a kind kept in one file may write, even
 * before that file exists; it is null for kinds kept as a directory of files.
 */
export type ProjectDataFilesReadResult =
  | { ok: true; isConfigured: boolean; fixedFileName: string | null; files: ProjectDataFile[] }
  | { ok: false; message: string };

/** Request that writes one project data file. */
export interface ProjectDataFileWriteRequest {
  /** Kind of data the file belongs to. */
  kind: ProjectDataFileKind;
  /** File name without directories. */
  name: string;
  /** New file text. */
  text: string;
}

/** Request that removes one project data file. */
export interface ProjectDataFileRemoveRequest {
  /** Kind of data the file belongs to. */
  kind: ProjectDataFileKind;
  /** File name without directories. */
  name: string;
}

/** Outcome of writing or removing a project data file. */
export type ProjectDataFileChangeResult = { ok: true } | { ok: false; message: string };
