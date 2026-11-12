import { ProjectFileLister } from '@/desktop/bun/project_files/project_file_lister.js';
import { ProjectFilePaths } from '@/desktop/bun/project_files/project_file_paths.js';
import { ProjectLevelPaths } from '@/desktop/bun/project_levels/project_level_paths.js';
import type { ProjectDefinition } from '@/project/model/project_definition.js';
import { projectLevelDocumentFileNameIs } from '@/project/model/project_level_entry.js';
import type { ProjectLevelSummary } from '@/project/level/project_level_types.js';

/**
 * Finds the levels of a project: the ones its project file lists, in file
 * order, followed by every other scene document found below the document
 * directory.
 */
export class ProjectLevelLister {
  /**
   * Lists the levels of a project; a missing document directory yields only the
   * listed levels.
   *
   * @param definition Open project.
   * @returns Listed levels first in file order, then discovered documents
   *   sorted by path.
   */
  static list(definition: ProjectDefinition): ProjectLevelSummary[] {
    const discovered = ProjectFileLister.list(definition.documentDirectory, [''], projectLevelDocumentFileNameIs);
    const listedDocuments = new Set(definition.levels.map((level) => level.document));
    const listed = definition.levels.map((level) => ProjectLevelLister.summaryRead(definition, level.document));
    const unlisted = discovered
      .filter((document) => !listedDocuments.has(document))
      .map((document) => ProjectLevelLister.summaryRead(definition, document));
    return [...listed, ...unlisted];
  }

  /**
   * Builds the summary of one document with its modification time.
   *
   * @param definition Open project.
   * @param document Normalized document path relative to the document
   *   directory.
   * @returns Level summary.
   */
  static summaryRead(definition: ProjectDefinition, document: string): ProjectLevelSummary {
    const absolutePath = ProjectFilePaths.absoluteJoin(definition.documentDirectory, document);
    return ProjectLevelPaths.summaryBuild(
      definition,
      document,
      ProjectLevelPaths.modifiedMillisecondsRead(absolutePath),
    );
  }
}
