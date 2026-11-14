import { readFileSync, statSync } from 'node:fs';
import { ProjectFileLister } from '@/desktop/bun/project_files/project_file_lister.js';
import { ProjectFileRealPath } from '@/desktop/bun/project_files/project_file_real_path.js';
import { ProjectSprinklePaths } from '@/desktop/bun/project_sprinkle/project_sprinkle_paths.js';
import type {
  SprinkleDefinitionFile,
  SprinkleDefinitionFilesReadResult,
} from '@/tools/sprinkle/definition/sprinkle_definition.js';

/** Largest sprinkle definition file returned, in bytes. */
export const PROJECT_SPRINKLE_DEFINITION_BYTE_LIMIT = 1024 * 1024;

/**
 * Reads every sprinkle definition file below a project's sprinkle directories,
 * refusing files that resolve outside the asset root or are too large.
 */
export class ProjectSprinkleDefinitionReader {
  private readonly byteLimit: number;

  /**
   * Creates a reader.
   *
   * @param byteLimit Largest file size it returns, in bytes.
   */
  constructor(byteLimit: number = PROJECT_SPRINKLE_DEFINITION_BYTE_LIMIT) {
    this.byteLimit = byteLimit;
  }

  /**
   * Lists and reads every ".txt" file below the sprinkle directories,
   * recursively and sorted by path.
   *
   * @param assetRoot Absolute asset root, forward slashes.
   * @param sprinkleDirectories Directories relative to the asset root.
   * @returns The files, or why they cannot be read.
   */
  readAll(assetRoot: string, sprinkleDirectories: readonly string[]): SprinkleDefinitionFilesReadResult {
    try {
      const paths = ProjectFileLister.list(assetRoot, sprinkleDirectories, ProjectSprinklePaths.isDefinitionFileName);
      return { ok: true, files: paths.map((path) => this.fileRead(assetRoot, path)) };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `Cannot read sprinkle definitions: ${reason}` };
    }
  }

  /**
   * Reads one definition file after checking where it really lives and how
   * large it is.
   *
   * @param assetRoot Absolute asset root.
   * @param relativePath Normalized file path relative to the asset root.
   * @returns The file.
   * @throws Error naming the file when it is refused.
   */
  private fileRead(assetRoot: string, relativePath: string): SprinkleDefinitionFile {
    const realFilePath = ProjectFileRealPath.insideRootResolve(assetRoot, relativePath);
    if (realFilePath === null) {
      throw new Error(`"${relativePath}" resolves outside the asset root`);
    }
    const byteSize = statSync(realFilePath).size;
    if (byteSize > this.byteLimit) {
      throw new Error(`"${relativePath}" has ${byteSize} bytes, more than the limit of ${this.byteLimit}`);
    }
    return { path: relativePath, text: readFileSync(realFilePath, 'utf8') };
  }
}
