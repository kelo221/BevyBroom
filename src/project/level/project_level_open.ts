import type { ProjectLevelSummary } from '@/project/level/project_level_types.js';

/** The project level the open scene was loaded from or last saved to. */
export interface ProjectLevelOpen {
  /** Project file the level belongs to, forward slashes. */
  projectFile: string;
  /** Level name the built level is published under. */
  id: string;
  /** Display name. */
  name: string;
  /** Document path relative to the document directory. */
  document: string;
  /**
   * Modification time of the document as the editor last read or wrote it, or
   * null when unknown.
   */
  knownModifiedMilliseconds: number | null;
}

/**
 * Builds the open level record of a listed level.
 *
 * @param projectFile Project file the level belongs to.
 * @param level Level as listed or returned by a write.
 * @returns Open level record.
 */
export function projectLevelOpenCreate(projectFile: string, level: ProjectLevelSummary): ProjectLevelOpen {
  return {
    projectFile,
    id: level.id,
    name: level.name,
    document: level.document,
    knownModifiedMilliseconds: level.modifiedMilliseconds,
  };
}
