import type { FaceUvTextureSizePixels } from '@/texture/uv/operations/face_uv_operation_context.js';
import { getTextureMapCache } from './texture_map_cache.js';

/**
 * Reads the decoded pixel size of a cached texture.
 *
 * @param textureId Texture identity.
 * @returns Image size, or null while the image is not decoded.
 */
export function textureSizePixelsRead(textureId: string): FaceUvTextureSizePixels | null {
  const image = getTextureMapCache().resolve(textureId).image as { width?: number; height?: number } | null;
  if (!image || !image.width || !image.height) {
    return null;
  }
  return { width: image.width, height: image.height };
}
