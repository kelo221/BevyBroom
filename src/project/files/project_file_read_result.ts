/** Bytes of one file of the open project, or why the file is not returned. */
export type ProjectFileReadResult =
  | {
      ok: true;
      /** File path relative to the asset root, forward slashes. */
      path: string;
      /** File contents as base64 text. */
      bytesBase64: string;
    }
  | { ok: false; message: string };
