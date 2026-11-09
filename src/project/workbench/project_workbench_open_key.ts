import type { GameProcessStatus } from '@/project/process/game_process_types.js';

/** The parts of the project workbench that tell which project is open. */
export interface ProjectWorkbenchOpenKeySource {
  /**
   * Returns the newest status.
   *
   * @returns Status, or null before a project was opened.
   */
  statusRead(): GameProcessStatus | null;
  /**
   * Returns how many times a project was opened.
   *
   * @returns Number of successful opens.
   */
  projectOpenCountRead(): number;
}

/**
 * Builds a key that changes whenever a project is opened, even the same one
 * again: the open count and the project file.
 *
 * @param source Workbench whose open project is read.
 * @returns Key, or null when no project is open.
 */
export function projectWorkbenchOpenKeyRead(source: ProjectWorkbenchOpenKeySource): string | null {
  const project = source.statusRead()?.project ?? null;
  return project === null ? null : `${source.projectOpenCountRead()}:${project.projectFile}`;
}
