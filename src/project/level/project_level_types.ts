/** Largest level document the desktop app reads for the editor, in bytes. */
export const PROJECT_LEVEL_DOCUMENT_BYTE_LIMIT = 256 * 1024 * 1024;

/** One level of the open project as the Level Browser lists it. */
export interface ProjectLevelSummary {
  /** Level name the built level is published under. */
  id: string;
  /** Display name. */
  name: string;
  /** Document path relative to the document directory, forward slashes. */
  document: string;
  /**
   * Modification time of the document in milliseconds since the epoch, or null
   * when the document does not exist yet.
   */
  modifiedMilliseconds: number | null;
  /** True when the project file lists the level explicitly. */
  isListed: boolean;
}

/** Levels of the open project. */
export type ProjectLevelListResult =
  | {
      ok: true;
      /** Project file the list belongs to, forward slashes. */
      projectFile: string;
      /** Absolute document directory, forward slashes. */
      documentDirectory: string;
      /** Listed levels first in file order, then discovered documents by path. */
      levels: ProjectLevelSummary[];
    }
  | { ok: false; message: string };

/** Text of one level document of the open project. */
export type ProjectLevelReadResult =
  | {
      ok: true;
      /** The level the document belongs to. */
      level: ProjectLevelSummary;
      /** Scene document text. */
      text: string;
    }
  | { ok: false; message: string };

/** Request to write the scene text of an existing level document. */
export interface ProjectLevelWriteRequest {
  /** Document path relative to the document directory. */
  document: string;
  /** Scene document text. */
  text: string;
  /**
   * Modification time the editor last saw for the document, or null to write
   * without checking; a newer file on disk refuses the write.
   */
  knownModifiedMilliseconds: number | null;
}

/** Request to create a new level document from a display name. */
export interface ProjectLevelCreateRequest {
  /** Display name typed by the level designer; the document file is derived. */
  name: string;
  /** Scene document text. */
  text: string;
}

/** Request to rename a level by moving its document. */
export interface ProjectLevelRenameRequest {
  /** Document path relative to the document directory. */
  document: string;
  /** New display name; the new document file is derived. */
  name: string;
}

/** Why a level write was refused without touching the file. */
export type ProjectLevelWriteRefusal = 'changed_on_disk' | 'exists' | 'invalid';

/** Outcome of writing, creating or renaming a level document. */
export type ProjectLevelWriteResult =
  | {
      ok: true;
      /** The level as it is listed after the write. */
      level: ProjectLevelSummary;
    }
  | {
      ok: false;
      message: string;
      /** Why the write was refused, when it was refused before writing. */
      refusal?: ProjectLevelWriteRefusal;
    };
