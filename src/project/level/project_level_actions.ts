import type { ProjectLevelService } from '@/project/level/project_level_service.js';
import type { ProjectLevelSummary, ProjectLevelWriteResult } from '@/project/level/project_level_types.js';

/** Outcome of opening a project level into the editor. */
export type ProjectLevelOpenResult = { ok: true; level: ProjectLevelSummary } | { ok: false; message: string };

/**
 * The level designer's actions on project levels: they move scene content
 * between the editor and the level documents of the open project and keep the
 * unsaved-work protection in step. The Level Browser, the File menu and the MCP
 * tools all run them.
 */
export interface ProjectLevelActions {
  /**
   * Returns the service that lists the levels and knows the open one.
   *
   * @returns Project level service.
   */
  serviceRead(): ProjectLevelService;
  /**
   * Loads a level document into the editor and makes it the open level.
   *
   * @param document Document path relative to the document directory.
   * @param isDiscardConfirmed True to ask before unsaved work is replaced.
   * @returns The opened level, or why nothing was loaded.
   */
  levelOpen(document: string, isDiscardConfirmed: boolean): Promise<ProjectLevelOpenResult>;
  /**
   * Writes the open scene back into the open level.
   *
   * @param isOverwriteAsked True to ask before replacing a document another
   *   program changed; otherwise such a save is refused.
   * @returns The level afterwards, or why nothing was written.
   */
  levelSave(isOverwriteAsked: boolean): Promise<ProjectLevelWriteResult>;
  /**
   * Saves the open scene as a new level of the project.
   *
   * @param name Display name of the new level.
   * @returns The new level, or why nothing was written.
   */
  levelSaveAsNew(name: string): Promise<ProjectLevelWriteResult>;
  /**
   * Replaces the scene with the startup scene and saves it as a new level.
   *
   * @param name Display name of the new level.
   * @param isDiscardConfirmed True to ask before unsaved work is replaced.
   * @returns The new level, or why nothing was created.
   */
  levelNew(name: string, isDiscardConfirmed: boolean): Promise<ProjectLevelWriteResult>;
  /**
   * Renames a level by moving its document.
   *
   * @param document Document path of the level to rename.
   * @param name New display name.
   * @returns The renamed level, or why nothing was moved.
   */
  levelRename(document: string, name: string): Promise<ProjectLevelWriteResult>;
  /**
   * Shows the Level Browser window.
   *
   * @param isNameFieldFocused True to put the keyboard focus into its name
   *   field, for naming a new level.
   */
  levelBrowserReveal(isNameFieldFocused: boolean): void;
}
