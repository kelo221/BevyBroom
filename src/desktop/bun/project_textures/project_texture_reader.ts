import { isImageFileName } from '@/texture/library/image_file_filter.js';
import {
  TEXTURE_PROJECT_FILE_BYTE_LIMIT,
  type TextureProjectReadResult,
} from '@/texture/project/texture_project_types.js';
import { ProjectFilePaths } from '@/desktop/bun/project_files/project_file_paths.js';
import { ProjectFileReader } from '@/desktop/bun/project_files/project_file_reader.js';

/**
 * Reads one image of a project's texture directories, refusing every path that
 * is not an image inside one of them or that resolves outside the asset root.
 */
export class ProjectTextureReader extends ProjectFileReader {
  /**
   * Creates a reader.
   *
   * @param byteLimit Largest file size it returns, in bytes.
   */
  constructor(byteLimit: number = TEXTURE_PROJECT_FILE_BYTE_LIMIT) {
    super(byteLimit, 'texture');
  }

  /**
   * Reads an image.
   *
   * @param assetRoot Absolute asset root, forward slashes.
   * @param textureDirectories Directories relative to the asset root.
   * @param texturePath Image path relative to the asset root.
   * @param projectDirectory Absolute project directory: a linked image may
   *   really live in it or in its git directory; the asset root when left out.
   * @returns The bytes as base64, or why the file is not returned.
   */
  read(
    assetRoot: string,
    textureDirectories: readonly string[],
    texturePath: string,
    projectDirectory: string = assetRoot,
  ): TextureProjectReadResult {
    const refusal = ProjectTextureReader.pathRefusalDescribe(textureDirectories, texturePath);
    return this.readUnlessRefused(assetRoot, texturePath, refusal, projectDirectory);
  }

  /**
   * Explains why a requested path is refused before touching the disk.
   *
   * @param textureDirectories Directories relative to the asset root.
   * @param texturePath Requested path.
   * @returns Reason, or null when the path may be read.
   */
  private static pathRefusalDescribe(textureDirectories: readonly string[], texturePath: string): string | null {
    const containedRefusal = ProjectFileReader.containedPathRefusalDescribe(texturePath);
    if (containedRefusal !== null) {
      return containedRefusal;
    }
    if (!isImageFileName(texturePath)) {
      return 'it is not an image file';
    }
    const relativePath = ProjectFilePaths.relativeNormalize(texturePath);
    const isInsideTextureDirectory = ProjectFilePaths.isInsideAnyDirectory(relativePath, textureDirectories);
    return isInsideTextureDirectory ? null : 'it is not inside a texture directory of the project';
  }
}
