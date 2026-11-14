import { readFileSync, statSync } from 'node:fs';
import { ProjectFilePaths } from '@/desktop/bun/project_files/project_file_paths.js';
import { ProjectFileRealPath } from '@/desktop/bun/project_files/project_file_real_path.js';
import { ProjectLevelLister } from '@/desktop/bun/project_levels/project_level_lister.js';
import { ProjectLevelPaths } from '@/desktop/bun/project_levels/project_level_paths.js';
import type { ProjectDefinition } from '@/project/model/project_definition.js';
import { PROJECT_LEVEL_DOCUMENT_BYTE_LIMIT, type ProjectLevelReadResult } from '@/project/level/project_level_types.js';

/**
 * Reads one level document of a project, refusing every path that is not a
 * scene document inside the document directory or that resolves outside it.
 */
export class ProjectLevelReader {
  private readonly byteLimit: number;

  /**
   * Creates a reader.
   *
   * @param byteLimit Largest document it returns, in bytes.
   */
  constructor(byteLimit: number = PROJECT_LEVEL_DOCUMENT_BYTE_LIMIT) {
    this.byteLimit = byteLimit;
  }

  /**
   * Reads a level document.
   *
   * @param definition Open project.
   * @param document Document path relative to the document directory.
   * @returns The level and its text, or why the document is not returned.
   */
  read(definition: ProjectDefinition, document: string): ProjectLevelReadResult {
    const refusal = ProjectLevelPaths.refusalDescribe(document);
    if (refusal !== null) {
      return ProjectLevelReader.failureCreate(document, refusal);
    }
    try {
      return this.fileRead(definition, ProjectFilePaths.relativeNormalize(document));
    } catch (error) {
      return ProjectLevelReader.failureCreate(document, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Reads a document after checking where it really lives and how large it is.
   *
   * @param definition Open project.
   * @param document Normalized document path.
   * @returns The level and its text, or why the document is not returned.
   */
  private fileRead(definition: ProjectDefinition, document: string): ProjectLevelReadResult {
    const realFilePath = ProjectFileRealPath.insideRootResolve(definition.documentDirectory, document);
    if (realFilePath === null) {
      return ProjectLevelReader.failureCreate(document, 'it resolves outside the document directory');
    }
    const byteSize = statSync(realFilePath).size;
    if (byteSize > this.byteLimit) {
      return ProjectLevelReader.failureCreate(document, `${byteSize} bytes exceed the limit of ${this.byteLimit}`);
    }
    const text = readFileSync(realFilePath, 'utf8');
    return { ok: true, level: ProjectLevelLister.summaryRead(definition, document), text };
  }

  /**
   * Builds a failure result.
   *
   * @param document Requested document path.
   * @param reason Why the document is not returned.
   * @returns Failure result naming the document.
   */
  private static failureCreate(document: string, reason: string): ProjectLevelReadResult {
    return { ok: false, message: `Cannot read level document "${document}": ${reason}` };
  }
}
