import type { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import { FaceUvOperation } from './face_uv_operation.js';
import type { FaceUvOperationContext } from './face_uv_operation_context.js';
import { shiftFaceUvRowOffset } from './face_uv_operation_math.js';

/** Texels per tile assumed when the texture image size is unknown. */
export const FACE_UV_RANDOM_SHIFT_FALLBACK_TEXELS = 64;

/** Source of uniformly distributed numbers in [0, 1). */
export type FaceUvRandomUnitSource = () => number;

/**
 * Shifts one texture axis by a random whole-texel offset inside one tile, so
 * repeated faces such as stair steps stop showing the same texture spot. Each
 * face keeps the offset it drew first, so re-running the operation on the same
 * face (redo) reproduces the same result.
 */
export class FaceUvOperationRandomShift extends FaceUvOperation {
  private readonly axis: 'u' | 'v';
  private readonly randomUnitRead: FaceUvRandomUnitSource;
  private readonly drawnTexelShiftByFaceKey: Map<string, number>;

  /**
   * Creates a random shift operation.
   *
   * @param axis Texture axis whose offset changes.
   * @param randomUnitRead Source of numbers in [0, 1).
   */
  constructor(axis: 'u' | 'v', randomUnitRead: FaceUvRandomUnitSource) {
    super();
    this.axis = axis;
    this.randomUnitRead = randomUnitRead;
    this.drawnTexelShiftByFaceKey = new Map();
  }

  /**
   * Adds a random whole-texel offset between one texel and one tile minus one
   * texel to the chosen axis.
   *
   * @param matrix Current UV matrix.
   * @param context Face context; its texture size sets the texel count.
   * @returns Matrix with only the chosen axis offset changed.
   */
  override apply(matrix: SurfaceUvMatrix, context: FaceUvOperationContext): SurfaceUvMatrix {
    const texelCount = this.texelCountRead(context);
    const texelShift = this.texelShiftForFace(context, texelCount);
    return shiftFaceUvRowOffset(matrix, this.axis, texelShift / texelCount);
  }

  /**
   * Reads how many texels one tile spans along the chosen axis.
   *
   * @param context Face context with an optional texture size.
   * @returns Whole texel count of at least two.
   */
  private texelCountRead(context: FaceUvOperationContext): number {
    const size = context.textureSizePixels;
    const pixels = size ? (this.axis === 'u' ? size.width : size.height) : FACE_UV_RANDOM_SHIFT_FALLBACK_TEXELS;
    if (!Number.isFinite(pixels) || pixels < 2) {
      return FACE_UV_RANDOM_SHIFT_FALLBACK_TEXELS;
    }
    return Math.floor(pixels);
  }

  /**
   * Returns the texel shift drawn for a face, drawing it on first use.
   *
   * @param context Face context identifying the face.
   * @param texelCount Texels per tile.
   * @returns Whole texel shift in [1, texelCount - 1].
   */
  private texelShiftForFace(context: FaceUvOperationContext, texelCount: number): number {
    const faceKey = faceUvRandomShiftFaceKey(context);
    const drawn = this.drawnTexelShiftByFaceKey.get(faceKey);
    if (drawn !== undefined) {
      return drawn;
    }
    const unit = Math.min(Math.max(this.randomUnitRead(), 0), 1 - Number.EPSILON);
    const texelShift = 1 + Math.floor(unit * (texelCount - 1));
    this.drawnTexelShiftByFaceKey.set(faceKey, texelShift);
    return texelShift;
  }
}

/**
 * Builds a key identifying a face by its rounded world centroid and normal.
 *
 * @param context Face context.
 * @returns Stable face key.
 */
function faceUvRandomShiftFaceKey(context: FaceUvOperationContext): string {
  const centroid = context.worldCentroid();
  const normal = context.faceNormal;
  return [centroid.x, centroid.y, centroid.z, normal.x, normal.y, normal.z]
    .map((component) => component.toFixed(4))
    .join(',');
}
