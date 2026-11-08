import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { isImageFileName } from '@/texture/library/image_file_filter.js';
import { ProjectDefinitionParser } from '@/project/model/project_definition_parser.js';
import {
  TEXTURE_PROJECT_FILE_BYTE_LIMIT,
  type TextureProjectReadResult,
} from '@/texture/project/texture_project_types.js';
import { ProjectTexturePaths } from '@/desktop/bun/project_textures/project_texture_paths.js';

/**
 * Reads one image of a project's texture directories, refusing every path that
 * is not an image inside one of them or that resolves outside the asset root.
 */
export class ProjectTextureReader {
  private readonly byteLimit: number;

  /**
   * Creates a reader.
   *
   * @param byteLimit Largest file size it returns, in bytes.
   */
  constructor(byteLimit: number = TEXTURE_PROJECT_FILE_BYTE_LIMIT) {
    this.byteLimit = byteLimit;
  }

  /**
   * Reads an image.
   *
   * @param assetRoot Absolute asset root, forward slashes.
   * @param textureDirectories Directories relative to the asset root.
   * @param texturePath Image path relative to the asset root.
   * @returns The bytes as base64, or why the file is not returned.
   */
  read(assetRoot: string, textureDirectories: readonly string[], texturePath: string): TextureProjectReadResult {
    const refusal = ProjectTextureReader.pathRefusalDescribe(textureDirectories, texturePath);
    if (refusal !== null) {
      return { ok: false, message: `Cannot read texture "${texturePath}": ${refusal}` };
    }
    try {
      return this.fileRead(assetRoot, ProjectTexturePaths.relativeNormalize(texturePath));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `Cannot read texture "${texturePath}": ${reason}` };
    }
  }

  /**
   * Explains why a requested path is refused before touching the disk.
   *
   * @param textureDirectories Directories relative to the asset root.
   * @param texturePath Requested path.
   * @returns Reason, or null when the path may be read.
   */
  private static pathRefusalDescribe(textureDirectories: readonly string[], texturePath: string): string | null {
    if (texturePath.trim() === '' || !ProjectDefinitionParser.isContainedRelativePath(texturePath)) {
      return 'it is not a path inside the asset root';
    }
    if (!isImageFileName(texturePath)) {
      return 'it is not an image file';
    }
    const relativePath = ProjectTexturePaths.relativeNormalize(texturePath);
    const isInsideTextureDirectory = textureDirectories.some((directory) =>
      ProjectTexturePaths.isInsideDirectory(relativePath, ProjectTexturePaths.relativeNormalize(directory)),
    );
    return isInsideTextureDirectory ? null : 'it is not inside a texture directory of the project';
  }

  /**
   * Reads a file after checking where it really lives and how large it is.
   *
   * @param assetRoot Absolute asset root.
   * @param relativePath Normalized image path relative to the asset root.
   * @returns The bytes as base64, or why the file is not returned.
   */
  private fileRead(assetRoot: string, relativePath: string): TextureProjectReadResult {
    const realFilePath = realpathSync(ProjectTexturePaths.absoluteJoin(assetRoot, relativePath));
    const pathFromRoot = relative(realpathSync(assetRoot), realFilePath);
    if (pathFromRoot === '' || pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) {
      return { ok: false, message: `Cannot read texture "${relativePath}": it resolves outside the asset root` };
    }
    const byteSize = statSync(realFilePath).size;
    if (byteSize > this.byteLimit) {
      return {
        ok: false,
        message: `Cannot read texture "${relativePath}": ${byteSize} bytes exceed the limit of ${this.byteLimit}`,
      };
    }
    return { ok: true, path: relativePath, bytesBase64: readFileSync(realFilePath).toString('base64') };
  }
}
