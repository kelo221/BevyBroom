/** Largest project model file the desktop app sends to the editor, in bytes. */
export const PROJECT_FILE_MODEL_BYTE_LIMIT = 64 * 1024 * 1024;

/** File extension of the models the editor draws, lowercase with the dot. */
const PROJECT_FILE_MODEL_EXTENSION = '.glb';

/**
 * Returns whether a file name is a binary glTF model.
 *
 * @param fileName File name or path.
 * @returns True when it ends in .glb, in any letter case.
 */
export function projectFileModelNameIs(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(PROJECT_FILE_MODEL_EXTENSION);
}
