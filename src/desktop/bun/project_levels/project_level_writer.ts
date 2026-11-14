import { ProjectFilePaths } from '@/desktop/bun/project_files/project_file_paths.js';
import {
  projectFileSystemNodeCreate,
  projectFileWriteAtomic,
  type ProjectFileSystem,
} from '@/desktop/bun/project_files/project_file_system_node.js';
import { ProjectLevelLister } from '@/desktop/bun/project_levels/project_level_lister.js';
import { ProjectLevelPaths } from '@/desktop/bun/project_levels/project_level_paths.js';
import type { ProjectDefinition } from '@/project/model/project_definition.js';
import { projectLevelDocumentFromName } from '@/project/model/project_level_entry.js';
import type {
  ProjectLevelCreateRequest,
  ProjectLevelRenameRequest,
  ProjectLevelWriteRefusal,
  ProjectLevelWriteRequest,
  ProjectLevelWriteResult,
} from '@/project/level/project_level_types.js';

/**
 * Writes level documents into a project's document directory: saves into an
 * existing document unless another program changed it, creates new documents
 * from a name without replacing existing ones, and renames documents the
 * project file does not list. Every write replaces the file in one rename.
 */
export class ProjectLevelWriter {
  private readonly fileSystem: ProjectFileSystem;

  /**
   * Creates a writer.
   *
   * @param fileSystem File operations; the real file system by default.
   */
  constructor(fileSystem: ProjectFileSystem = projectFileSystemNodeCreate()) {
    this.fileSystem = fileSystem;
  }

  /**
   * Writes the text of an existing or new document at a known path.
   *
   * @param definition Open project.
   * @param request Document, text and the modification time the editor knows.
   * @returns The level afterwards, or why nothing was written.
   */
  write(definition: ProjectDefinition, request: ProjectLevelWriteRequest): ProjectLevelWriteResult {
    const refusal = ProjectLevelPaths.refusalDescribe(request.document);
    if (refusal !== null) {
      return ProjectLevelWriter.failureCreate(request.document, refusal, 'invalid');
    }
    const document = ProjectFilePaths.relativeNormalize(request.document);
    const modified = ProjectLevelPaths.modifiedMillisecondsRead(this.absolutePath(definition, document));
    if (ProjectLevelWriter.isChangedOnDisk(modified, request.knownModifiedMilliseconds)) {
      return ProjectLevelWriter.failureCreate(document, 'another program changed it', 'changed_on_disk');
    }
    return this.textWrite(definition, document, request.text);
  }

  /**
   * Creates a new document named after a level name.
   *
   * @param definition Open project.
   * @param request Display name and text.
   * @returns The new level, or why nothing was written.
   */
  create(definition: ProjectDefinition, request: ProjectLevelCreateRequest): ProjectLevelWriteResult {
    if (request.name.trim() === '') {
      return ProjectLevelWriter.failureCreate(request.name, 'the level needs a name', 'invalid');
    }
    const document = projectLevelDocumentFromName(request.name);
    if (ProjectLevelPaths.modifiedMillisecondsRead(this.absolutePath(definition, document)) !== null) {
      return ProjectLevelWriter.failureCreate(document, 'a level with that document already exists', 'exists');
    }
    return this.textWrite(definition, document, request.text);
  }

  /**
   * Renames a level by moving its document to the file its new name derives.
   *
   * @param definition Open project.
   * @param request Document to move and the new display name.
   * @returns The renamed level, or why nothing was moved.
   */
  rename(definition: ProjectDefinition, request: ProjectLevelRenameRequest): ProjectLevelWriteResult {
    const refusal = this.renameRefusalDescribe(definition, request);
    if (refusal !== null) {
      return ProjectLevelWriter.failureCreate(request.document, refusal.reason, refusal.refusal);
    }
    const document = ProjectFilePaths.relativeNormalize(request.document);
    const target = projectLevelDocumentFromName(request.name);
    try {
      this.fileSystem.fileRename(this.absolutePath(definition, document), this.absolutePath(definition, target));
    } catch (error) {
      return ProjectLevelWriter.failureCreate(document, error instanceof Error ? error.message : String(error));
    }
    return { ok: true, level: ProjectLevelLister.summaryRead(definition, target) };
  }

  /**
   * Explains why a rename is refused before touching the disk.
   *
   * @param definition Open project.
   * @param request Document to move and the new display name.
   * @returns Reason and refusal kind, or null when the rename may proceed.
   */
  private renameRefusalDescribe(
    definition: ProjectDefinition,
    request: ProjectLevelRenameRequest,
  ): { reason: string; refusal: ProjectLevelWriteRefusal } | null {
    const pathRefusal = ProjectLevelPaths.refusalDescribe(request.document);
    if (pathRefusal !== null) {
      return { reason: pathRefusal, refusal: 'invalid' };
    }
    const document = ProjectFilePaths.relativeNormalize(request.document);
    if (request.name.trim() === '') {
      return { reason: 'the level needs a name', refusal: 'invalid' };
    }
    if (definition.levels.some((level) => level.document === document)) {
      return { reason: 'the project file lists it; rename it there', refusal: 'invalid' };
    }
    if (ProjectLevelPaths.modifiedMillisecondsRead(this.absolutePath(definition, document)) === null) {
      return { reason: 'the document does not exist', refusal: 'invalid' };
    }
    const target = projectLevelDocumentFromName(request.name);
    const isTargetTaken = ProjectLevelPaths.modifiedMillisecondsRead(this.absolutePath(definition, target)) !== null;
    return isTargetTaken ? { reason: 'a level with that document already exists', refusal: 'exists' } : null;
  }

  /**
   * Writes text to a document, creating the directories above it.
   *
   * @param definition Open project.
   * @param document Normalized document path.
   * @param text Scene document text.
   * @returns The level afterwards, or why nothing was written.
   */
  private textWrite(definition: ProjectDefinition, document: string, text: string): ProjectLevelWriteResult {
    const absolutePath = this.absolutePath(definition, document);
    try {
      this.fileSystem.directoryEnsure(absolutePath.slice(0, absolutePath.lastIndexOf('/')));
      projectFileWriteAtomic(this.fileSystem, absolutePath, new TextEncoder().encode(text));
    } catch (error) {
      return ProjectLevelWriter.failureCreate(document, error instanceof Error ? error.message : String(error));
    }
    return { ok: true, level: ProjectLevelLister.summaryRead(definition, document) };
  }

  /**
   * Returns the absolute path of a document.
   *
   * @param definition Open project.
   * @param document Normalized document path.
   * @returns Absolute path, forward slashes.
   */
  private absolutePath(definition: ProjectDefinition, document: string): string {
    return ProjectFilePaths.absoluteJoin(definition.documentDirectory, document);
  }

  /**
   * Returns whether the file on disk is newer than the editor's copy.
   *
   * @param modifiedMilliseconds Modification time on disk, or null when
   *   missing.
   * @param knownModifiedMilliseconds Modification time the editor knows, or
   *   null to skip the check.
   * @returns True when a save would overwrite a newer file.
   */
  private static isChangedOnDisk(
    modifiedMilliseconds: number | null,
    knownModifiedMilliseconds: number | null,
  ): boolean {
    return (
      knownModifiedMilliseconds !== null &&
      modifiedMilliseconds !== null &&
      modifiedMilliseconds > knownModifiedMilliseconds
    );
  }

  /**
   * Builds a failure result.
   *
   * @param document Requested document or name.
   * @param reason Why nothing was written.
   * @param refusal Refusal kind when the write was refused before writing.
   * @returns Failure result naming the document.
   */
  private static failureCreate(
    document: string,
    reason: string,
    refusal?: ProjectLevelWriteRefusal,
  ): ProjectLevelWriteResult {
    const message = `Cannot write level document "${document}": ${reason}`;
    return refusal === undefined ? { ok: false, message } : { ok: false, message, refusal };
  }
}
