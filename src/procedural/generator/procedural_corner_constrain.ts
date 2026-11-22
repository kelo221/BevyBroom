import { ProceduralParametersRead } from '@/procedural/generator/procedural_parameters_read.js';
import type { ProceduralParameters } from '@/procedural/model/procedural_settings.js';

/** Rules for the two opposite corners of a box-shaped generator. */
export class ProceduralCornerConstrain {
  /**
   * Moves the second corner away from the first along every axis where the box
   * would be thinner than a smallest size.
   *
   * @param parameters Parameters with valid corners.
   * @param cornerAPath Field path of the first corner.
   * @param cornerBPath Field path of the opposite corner, the one that moves.
   * @param minimumSize Smallest distance kept between the corners on each axis.
   * @returns Parameters of a box with a volume.
   */
  static minimumSizeKeep(
    parameters: ProceduralParameters,
    cornerAPath: string,
    cornerBPath: string,
    minimumSize: number,
  ): ProceduralParameters {
    const cornerA = ProceduralParametersRead.vector3(parameters, cornerAPath);
    const cornerB = ProceduralParametersRead.vector3(parameters, cornerBPath);
    for (const axis of ['x', 'y', 'z'] as const) {
      if (Math.abs(cornerB[axis] - cornerA[axis]) < minimumSize) {
        cornerB[axis] = cornerA[axis] + minimumSize;
      }
    }
    return { ...parameters, [cornerBPath]: ProceduralParametersRead.vector3Value(cornerB) };
  }
}
