import type { SolidBrush } from '@/solid/brush/solid_brush.js';
import type { SolidPlane } from '@/solid/brush/solid_plane.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';

/**
 * A brush of the evaluated list with what a piece plane may take its texture
 * from.
 */
export interface CollisionTextureSource {
  /** Convex brush in world space. */
  readonly brush: SolidBrush;
  readonly operation: SolidOperation;
  /**
   * Returns the texture of one face of the brush.
   *
   * @param faceIndex Face index.
   * @returns Texture id.
   */
  textureOfFace(faceIndex: number): string;
}

/**
 * Finds the texture of a piece's plane: the face of a brush lying on it. The
 * piece's own brush is asked first; a face of a subtractive brush lies on the
 * plane facing the other way, because a carved wall faces into the hole.
 */
export class CollisionPlaneTextureResolver {
  /**
   * Creates a resolver over the evaluated brushes.
   *
   * @param sources Brushes by evaluated index.
   */
  constructor(private readonly sources: readonly CollisionTextureSource[]) {}

  /**
   * Returns the texture of a plane of a piece.
   *
   * @param plane Outward plane of the piece.
   * @param sourceIndex Index of the brush the piece was cut from, or -1.
   * @returns Texture id, empty when no brush face lies on the plane.
   */
  textureOf(plane: SolidPlane, sourceIndex: number): string {
    const own = this.sources[sourceIndex];
    const ownTexture = own ? CollisionPlaneTextureResolver.faceTextureOn(own, plane, false) : null;
    if (ownTexture !== null) {
      return ownTexture;
    }
    for (const source of this.sources) {
      const isReversed = source.operation === SolidOperation.Subtractive;
      const texture = CollisionPlaneTextureResolver.faceTextureOn(source, plane, isReversed);
      if (texture !== null) {
        return texture;
      }
    }
    return '';
  }

  /**
   * Returns the texture of the face of a brush that lies on a plane.
   *
   * @param source Brush and its textures.
   * @param plane Plane of a piece.
   * @param isReversed True to match faces facing the other way.
   * @returns Texture id, or null when no face lies on the plane.
   */
  private static faceTextureOn(source: CollisionTextureSource, plane: SolidPlane, isReversed: boolean): string | null {
    const faceIndex = source.brush.planes.findIndex((facePlane) =>
      isReversed ? facePlane.isReverseAlignedWith(plane) : facePlane.isAlignedWith(plane),
    );
    return faceIndex < 0 ? null : source.textureOfFace(faceIndex);
  }
}
