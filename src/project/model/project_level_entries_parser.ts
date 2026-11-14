import { PreviewLaunchCommandError } from '@/preview/launch/preview_launch_command.js';
import { levelBuildNameSanitize } from '@/level_build/manifest/level_build_manifest.js';
import {
  PROJECT_LEVEL_DOCUMENT_DIRECTORY_DEFAULT,
  projectLevelDocumentFileNameIs,
  projectLevelDocumentStemRead,
  type ProjectLevelEntry,
} from '@/project/model/project_level_entry.js';

/** Top-level field holding the document directory. */
const PROJECT_LEVEL_DOCUMENT_DIRECTORY_FIELD = 'document_directory';

/** Top-level field holding the explicit level list. */
const PROJECT_LEVEL_LIST_FIELD = 'levels';

/**
 * Reads the document directory and the explicit level list of a project file.
 * Throws {@link PreviewLaunchCommandError} naming the field when either is
 * malformed.
 */
export class ProjectLevelEntriesParser {
  /**
   * Reads the document directory relative to the project directory, defaulting
   * when the field is absent.
   *
   * @param project Parsed project object.
   * @param isContainedRelativePath Tells whether a path stays inside its base.
   * @returns Project-relative directory with forward slashes and no trailing
   *   slash.
   */
  static documentDirectoryRead(
    project: Record<string, unknown>,
    isContainedRelativePath: (path: string) => boolean,
  ): string {
    const value = project[PROJECT_LEVEL_DOCUMENT_DIRECTORY_FIELD] ?? PROJECT_LEVEL_DOCUMENT_DIRECTORY_DEFAULT;
    if (typeof value !== 'string' || value.trim() === '') {
      throw new PreviewLaunchCommandError(
        `project.${PROJECT_LEVEL_DOCUMENT_DIRECTORY_FIELD} must be a non-empty string`,
      );
    }
    if (!isContainedRelativePath(value)) {
      throw new PreviewLaunchCommandError(
        `project.${PROJECT_LEVEL_DOCUMENT_DIRECTORY_FIELD} "${value}" must be a path inside the project`,
      );
    }
    return value.replace(/\\/g, '/').replace(/\/+$/, '') || '.';
  }

  /**
   * Reads the optional explicit level list.
   *
   * @param project Parsed project object.
   * @param isContainedRelativePath Tells whether a path stays inside its base.
   * @returns Levels in file order, empty when the field is absent.
   */
  static levelsRead(
    project: Record<string, unknown>,
    isContainedRelativePath: (path: string) => boolean,
  ): ProjectLevelEntry[] {
    const value = project[PROJECT_LEVEL_LIST_FIELD] ?? [];
    if (!Array.isArray(value)) {
      throw new PreviewLaunchCommandError(`project.${PROJECT_LEVEL_LIST_FIELD} must be a list of level entries`);
    }
    const entries = value.map((entry: unknown, index: number) =>
      ProjectLevelEntriesParser.levelRead(entry, index, isContainedRelativePath),
    );
    ProjectLevelEntriesParser.duplicatesReject(entries);
    return entries;
  }

  /**
   * Reads one level entry.
   *
   * @param entry Entry from the project file.
   * @param index Position of the entry, used in messages.
   * @param isContainedRelativePath Tells whether a path stays inside its base.
   * @returns Level entry with a sanitized id and a normalized document path.
   */
  private static levelRead(
    entry: unknown,
    index: number,
    isContainedRelativePath: (path: string) => boolean,
  ): ProjectLevelEntry {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new PreviewLaunchCommandError(`project.${PROJECT_LEVEL_LIST_FIELD}[${index}] must be an object`);
    }
    const record = entry as Record<string, unknown>;
    const document = ProjectLevelEntriesParser.documentRead(record, index, isContainedRelativePath);
    const id =
      ProjectLevelEntriesParser.optionalTextRead(record, 'id', index) ?? projectLevelDocumentStemRead(document);
    const name = ProjectLevelEntriesParser.optionalTextRead(record, 'name', index) ?? id;
    return { id: levelBuildNameSanitize(id), name, document };
  }

  /**
   * Reads the required document path of an entry.
   *
   * @param record Entry object.
   * @param index Position of the entry, used in messages.
   * @param isContainedRelativePath Tells whether a path stays inside its base.
   * @returns Document path with forward slashes.
   */
  private static documentRead(
    record: Record<string, unknown>,
    index: number,
    isContainedRelativePath: (path: string) => boolean,
  ): string {
    const fieldPath = `project.${PROJECT_LEVEL_LIST_FIELD}[${index}].document`;
    const document = record['document'];
    if (typeof document !== 'string' || document.trim() === '') {
      throw new PreviewLaunchCommandError(`${fieldPath} must be a non-empty string`);
    }
    if (!isContainedRelativePath(document)) {
      throw new PreviewLaunchCommandError(`${fieldPath} "${document}" must be a path inside the document directory`);
    }
    if (!projectLevelDocumentFileNameIs(document)) {
      throw new PreviewLaunchCommandError(`${fieldPath} "${document}" must be a .json scene document`);
    }
    return document.replace(/\\/g, '/').replace(/^(\.\/)+/, '');
  }

  /**
   * Reads an optional text field of an entry.
   *
   * @param record Entry object.
   * @param fieldName Field to read.
   * @param index Position of the entry, used in messages.
   * @returns Trimmed text, or null when the field is absent.
   */
  private static optionalTextRead(record: Record<string, unknown>, fieldName: string, index: number): string | null {
    const value = record[fieldName];
    if (value === undefined) {
      return null;
    }
    if (typeof value !== 'string' || value.trim() === '') {
      throw new PreviewLaunchCommandError(
        `project.${PROJECT_LEVEL_LIST_FIELD}[${index}].${fieldName} must be a non-empty string`,
      );
    }
    return value.trim();
  }

  /**
   * Rejects lists in which two entries share an id or a document.
   *
   * @param entries Parsed entries.
   */
  private static duplicatesReject(entries: readonly ProjectLevelEntry[]): void {
    const seenIds = new Set<string>();
    const seenDocuments = new Set<string>();
    entries.forEach((entry) => {
      if (seenIds.has(entry.id) || seenDocuments.has(entry.document)) {
        throw new PreviewLaunchCommandError(
          `project.${PROJECT_LEVEL_LIST_FIELD} lists level "${entry.id}" (${entry.document}) more than once`,
        );
      }
      seenIds.add(entry.id);
      seenDocuments.add(entry.document);
    });
  }
}
