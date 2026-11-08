/** Image extensions accepted by the texture browser folder scan. */
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);

/** MIME types of the accepted image extensions that are not image/<extension>. */
const IMAGE_MIME_TYPE_OVERRIDES: Readonly<Record<string, string>> = { jpg: 'image/jpeg', svg: 'image/svg+xml' };

/**
 * Returns the MIME type of an image file name.
 *
 * @param fileName File name or path with extension (case-insensitive).
 * @returns MIME type of an accepted image extension, image/png otherwise.
 */
export function imageFileMimeType(fileName: string): string {
  const extension = extractFileExtension(fileName);
  if (!IMAGE_EXTENSIONS.has(extension)) {
    return 'image/png';
  }
  return IMAGE_MIME_TYPE_OVERRIDES[extension] ?? `image/${extension}`;
}

/**
 * Returns whether a file name looks like a supported image texture.
 *
 * @param fileName File name or path segment (case-insensitive).
 * @returns True when the extension is a known image type.
 */
export function isImageFileName(fileName: string): boolean {
  const extension = extractFileExtension(fileName);
  if (!extension) return false;
  return IMAGE_EXTENSIONS.has(extension);
}

/**
 * Extracts the lower-case extension without the leading dot.
 *
 * @param fileName File name or path.
 * @returns Extension string, or empty when none.
 */
export function extractFileExtension(fileName: string): string {
  const baseName = fileName.split(/[/\\]/).pop() ?? fileName;
  const dotIndex = baseName.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === baseName.length - 1) return '';
  return baseName.slice(dotIndex + 1).toLowerCase();
}

/**
 * Builds a short display name (file stem) for grid labels.
 *
 * @param fileName File name including extension.
 * @returns Name without extension, or the original when none.
 */
export function getTextureDisplayName(fileName: string): string {
  const baseName = fileName.split(/[/\\]/).pop() ?? fileName;
  const dotIndex = baseName.lastIndexOf('.');
  if (dotIndex <= 0) return baseName;
  return baseName.slice(0, dotIndex);
}

/**
 * Returns the set of accepted image extensions (for tests and UI hints).
 *
 * @returns Copy of the extension list.
 */
export function getAcceptedImageExtensions(): string[] {
  return Array.from(IMAGE_EXTENSIONS).sort();
}
