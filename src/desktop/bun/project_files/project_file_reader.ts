import { readFileSync, statSync } from 'node:fs';
import { ProjectDefinitionParser } from '@/project/model/project_definition_parser.js';
import type { ProjectFileReadResult } from '@/project/files/project_file_read_result.js';
import { ProjectFilePaths } from '@/desktop/bun/project_files/project_file_paths.js';
import { ProjectFileRealPath } from '@/desktop/bun/project_files/project_file_real_path.js';

/**
 * Base of the readers that return one file of a project's asset root to the
 * editor. It refuses files larger than its byte limit and paths that resolve
 * outside the asset root; derived readers add the paths they refuse.
 */
export abstract class ProjectFileReader {
  private readonly byteLimit: number;
  private readonly fileKindLabel: string;

  /**
   * Creates a reader.
   *
   * @param byteLimit Largest file size it returns, in bytes.
   * @param fileKindLabel Word naming the kind of file in messages, such as
   *   "texture".
   */
  protected constructor(byteLimit: number, fileKindLabel: string) {
    this.byteLimit = byteLimit;
    this.fileKindLabel = fileKindLabel;
  }

  /**
   * Reads a file unless a refusal was found for its path.
   *
   * @param assetRoot Absolute asset root, forward slashes.
   * @param requestedPath File path relative to the asset root as requested.
   * @param refusal Why the path is refused, or null when it may be read.
   * @returns The bytes as base64, or why the file is not returned.
   */
  protected readUnlessRefused(assetRoot: string, requestedPath: string, refusal: string | null): ProjectFileReadResult {
    if (refusal !== null) {
      return this.failureCreate(requestedPath, refusal);
    }
    try {
      return this.fileRead(assetRoot, ProjectFilePaths.relativeNormalize(requestedPath));
    } catch (error) {
      return this.failureCreate(requestedPath, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Explains why a path is not a relative path inside the asset root.
   *
   * @param requestedPath Requested path.
   * @returns Reason, or null when the path stays inside the asset root.
   */
  protected static containedPathRefusalDescribe(requestedPath: string): string | null {
    const isContained = requestedPath.trim() !== '' && ProjectDefinitionParser.isContainedRelativePath(requestedPath);
    return isContained ? null : 'it is not a path inside the asset root';
  }

  /**
   * Reads a file after checking where it really lives and how large it is.
   *
   * @param assetRoot Absolute asset root.
   * @param relativePath Normalized file path relative to the asset root.
   * @returns The bytes as base64, or why the file is not returned.
   */
  private fileRead(assetRoot: string, relativePath: string): ProjectFileReadResult {
    const realFilePath = ProjectFileRealPath.insideRootResolve(assetRoot, relativePath);
    if (realFilePath === null) {
      return this.failureCreate(relativePath, 'it resolves outside the asset root');
    }
    const byteSize = statSync(realFilePath).size;
    if (byteSize > this.byteLimit) {
      return this.failureCreate(relativePath, `${byteSize} bytes exceed the limit of ${this.byteLimit}`);
    }
    return { ok: true, path: relativePath, bytesBase64: readFileSync(realFilePath).toString('base64') };
  }

  /**
   * Builds the failure result of one file.
   *
   * @param path Path the failure is about.
   * @param reason Why the file is not returned.
   * @returns Failure result naming the file kind and path.
   */
  private failureCreate(path: string, reason: string): ProjectFileReadResult {
    return { ok: false, message: `Cannot read ${this.fileKindLabel} "${path}": ${reason}` };
  }
}
