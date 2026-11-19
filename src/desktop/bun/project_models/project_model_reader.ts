import type { ProjectFileReadResult } from '@/project/files/project_file_read_result.js';
import { PROJECT_FILE_MODEL_BYTE_LIMIT, projectFileModelNameIs } from '@/project/files/project_file_model.js';
import { ProjectFileReader } from '@/desktop/bun/project_files/project_file_reader.js';

/**
 * Reads one binary glTF model below a project's asset root, refusing every path
 * that is not a .glb file or that resolves outside the asset root.
 */
export class ProjectModelReader extends ProjectFileReader {
  /**
   * Creates a reader.
   *
   * @param byteLimit Largest file size it returns, in bytes.
   */
  constructor(byteLimit: number = PROJECT_FILE_MODEL_BYTE_LIMIT) {
    super(byteLimit, 'model');
  }

  /**
   * Reads a model.
   *
   * @param assetRoot Absolute asset root, forward slashes.
   * @param modelPath Model path relative to the asset root.
   * @returns The bytes as base64, or why the file is not returned.
   */
  read(assetRoot: string, modelPath: string): ProjectFileReadResult {
    return this.readUnlessRefused(assetRoot, modelPath, ProjectModelReader.pathRefusalDescribe(modelPath));
  }

  /**
   * Explains why a requested path is refused before touching the disk.
   *
   * @param modelPath Requested path.
   * @returns Reason, or null when the path may be read.
   */
  private static pathRefusalDescribe(modelPath: string): string | null {
    const containedRefusal = ProjectFileReader.containedPathRefusalDescribe(modelPath);
    if (containedRefusal !== null) {
      return containedRefusal;
    }
    return projectFileModelNameIs(modelPath) ? null : 'it is not a binary glTF (.glb) file';
  }
}
