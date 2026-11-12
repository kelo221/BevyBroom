import { statSync } from 'node:fs';
import { ProjectFilePaths } from '@/desktop/bun/project_files/project_file_paths.js';
import { ProjectDefinitionParser } from '@/project/model/project_definition_parser.js';
import type { ProjectDefinition } from '@/project/model/project_definition.js';
import {
  projectLevelDocumentFileNameIs,
  projectLevelDocumentStemRead,
  projectLevelIdFromDocument,
} from '@/project/model/project_level_entry.js';
import type { ProjectLevelSummary } from '@/project/level/project_level_types.js';

/**
 * Rules for which files of a project are level documents and how they are
 * described.
 */
export class ProjectLevelPaths {
  /**
   * Explains why a requested document path is refused before touching the disk.
   *
   * @param document Requested path relative to the document directory.
   * @returns Reason, or null when the path may be used.
   */
  static refusalDescribe(document: string): string | null {
    if (document.trim() === '' || !ProjectDefinitionParser.isContainedRelativePath(document)) {
      return 'it is not a path inside the document directory';
    }
    if (!projectLevelDocumentFileNameIs(document)) {
      return 'it is not a .json scene document';
    }
    return ProjectFilePaths.relativeNormalize(document) === '' ? 'it names no file' : null;
  }

  /**
   * Builds the summary of a level from its document, taking id and name from
   * the project file when it lists the document.
   *
   * @param definition Open project.
   * @param document Normalized document path relative to the document
   *   directory.
   * @param modifiedMilliseconds Modification time of the document, or null when
   *   it does not exist.
   * @returns Level summary.
   */
  static summaryBuild(
    definition: ProjectDefinition,
    document: string,
    modifiedMilliseconds: number | null,
  ): ProjectLevelSummary {
    const listed = definition.levels.find((level) => level.document === document);
    if (listed) {
      return { id: listed.id, name: listed.name, document, modifiedMilliseconds, isListed: true };
    }
    return {
      id: projectLevelIdFromDocument(document),
      name: projectLevelDocumentStemRead(document),
      document,
      modifiedMilliseconds,
      isListed: false,
    };
  }

  /**
   * Reads the modification time of a document.
   *
   * @param absolutePath Absolute document path.
   * @returns Milliseconds since the epoch, or null when the file is missing.
   */
  static modifiedMillisecondsRead(absolutePath: string): number | null {
    const stats = statSync(absolutePath, { throwIfNoEntry: false });
    return stats === undefined || !stats.isFile() ? null : Math.round(stats.mtimeMs);
  }
}
