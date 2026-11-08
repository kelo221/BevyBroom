import { ProjectFilePaths } from '@/desktop/bun/project_files/project_file_paths.js';
import { ProjectFileRealPath } from '@/desktop/bun/project_files/project_file_real_path.js';
import { ProjectSprinklePaths } from '@/desktop/bun/project_sprinkle/project_sprinkle_paths.js';
import { DesktopShellOpen } from '@/desktop/bun/shell/desktop_shell_open.js';
import type { SprinkleDefinitionOpenResult } from '@/tools/sprinkle/definition/sprinkle_definition.js';

/** Opens an absolute file path with the system's default application. */
export type ProjectSprinkleShellOpen = (absolutePath: string) => Promise<void>;

/**
 * Opens a sprinkle definition file in the system's text editor, refusing every
 * path that is not a definition file inside a sprinkle directory or that
 * resolves outside the asset root.
 */
export class ProjectSprinkleDefinitionOpener {
  private readonly shellOpen: ProjectSprinkleShellOpen;

  /**
   * Creates an opener.
   *
   * @param shellOpen Opens an absolute path with its default application.
   */
  constructor(shellOpen: ProjectSprinkleShellOpen = DesktopShellOpen.launch) {
    this.shellOpen = shellOpen;
  }

  /**
   * Opens a definition file.
   *
   * @param assetRoot Absolute asset root, forward slashes.
   * @param sprinkleDirectories Directories relative to the asset root.
   * @param definitionPath File path relative to the asset root.
   * @returns Success, or why the file was not opened.
   */
  async open(
    assetRoot: string,
    sprinkleDirectories: readonly string[],
    definitionPath: string,
  ): Promise<SprinkleDefinitionOpenResult> {
    const refusal = ProjectSprinklePaths.refusalDescribe(sprinkleDirectories, definitionPath);
    if (refusal !== null) {
      return ProjectSprinkleDefinitionOpener.failureCreate(definitionPath, refusal);
    }
    try {
      return await this.fileOpen(assetRoot, ProjectFilePaths.relativeNormalize(definitionPath));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return ProjectSprinkleDefinitionOpener.failureCreate(definitionPath, reason);
    }
  }

  /**
   * Opens a file after checking where it really lives.
   *
   * @param assetRoot Absolute asset root.
   * @param relativePath Normalized file path relative to the asset root.
   * @returns Success, or why the file was not opened.
   */
  private async fileOpen(assetRoot: string, relativePath: string): Promise<SprinkleDefinitionOpenResult> {
    const realFilePath = ProjectFileRealPath.insideAssetRootResolve(assetRoot, relativePath);
    if (realFilePath === null) {
      return ProjectSprinkleDefinitionOpener.failureCreate(relativePath, 'it resolves outside the asset root');
    }
    await this.shellOpen(realFilePath);
    return { ok: true };
  }

  /**
   * Builds a failure result.
   *
   * @param definitionPath Requested path.
   * @param reason Why the file was not opened.
   * @returns Failure result naming the path.
   */
  private static failureCreate(definitionPath: string, reason: string): SprinkleDefinitionOpenResult {
    return { ok: false, message: `Cannot open sprinkle definition "${definitionPath}": ${reason}` };
  }
}
