/** Largest project texture file the desktop app sends to the editor, in bytes. */
export const TEXTURE_PROJECT_FILE_BYTE_LIMIT = 64 * 1024 * 1024;

/** Images found in the texture directories of the open project. */
export type TextureProjectListResult =
  | {
      ok: true;
      /** Project file the list belongs to, forward slashes. */
      projectFile: string;
      /** Image paths relative to the asset root, forward slashes, sorted. */
      texturePaths: string[];
    }
  | { ok: false; message: string };

/** Bytes of one image of the open project's texture directories. */
export type TextureProjectReadResult =
  | {
      ok: true;
      /** Image path relative to the asset root, forward slashes. */
      path: string;
      /** File contents as base64 text. */
      bytesBase64: string;
    }
  | { ok: false; message: string };
