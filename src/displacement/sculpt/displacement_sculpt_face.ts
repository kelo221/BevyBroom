import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import type { DisplacementFaceSurface } from '@/displacement/model/displacement_types.js';
import {
  displacementOffsetDeltaForDistance,
  displacementSurfaceClone,
} from '@/displacement/model/displacement_face_surface.js';
import { DisplacementSurfacePlacement } from '@/displacement/grid/displacement_surface_placement.js';
import type { DisplacementFaceEdit } from '@/displacement/commands/command_displacement_edit.js';

/**
 * Editable copy of one displaced brush face placed in world space. Sculpt
 * operations change the copy; the result is committed through a displacement
 * edit command.
 */
export class DisplacementSculptFace {
  readonly target: SolidFaceTextureTarget;
  readonly placement: DisplacementSurfacePlacement;
  readonly displacement: DisplacementFaceSurface;

  /**
   * Creates a sculpt face.
   *
   * @param target Brush face.
   * @param placement World-space grid placement.
   * @param displacement Working copy of the face's displacement.
   */
  private constructor(
    target: SolidFaceTextureTarget,
    placement: DisplacementSurfacePlacement,
    displacement: DisplacementFaceSurface,
  ) {
    this.target = target;
    this.placement = placement;
    this.displacement = displacement;
  }

  /**
   * Loads the displacement of a brush face for sculpting.
   *
   * @param target Brush face.
   * @returns Sculpt face, or null when the face has no usable displacement.
   */
  static fromTarget(target: SolidFaceTextureTarget): DisplacementSculptFace | null {
    const brush = target.model.findBrush(target.brushId);
    const stored = brush?.faceDisplacementRead(target.surfaceIndex);
    if (!brush || !stored) {
      return null;
    }
    const displacement = displacementSurfaceClone(stored);
    const placement = DisplacementSurfacePlacement.forWorldSpace(
      brush,
      target.surfaceIndex,
      displacement,
      target.model.root,
    );
    return placement ? new DisplacementSculptFace(target, placement, displacement) : null;
  }

  /**
   * Loads every target that carries a usable displacement.
   *
   * @param targets Brush faces.
   * @returns Sculpt faces of the displaced targets.
   */
  static listFromTargets(targets: readonly SolidFaceTextureTarget[]): DisplacementSculptFace[] {
    return targets
      .map((target) => DisplacementSculptFace.fromTarget(target))
      .filter((face): face is DisplacementSculptFace => face !== null);
  }

  /**
   * Returns the grid side length of the working copy.
   *
   * @returns Vertices per side.
   */
  rowLength(): number {
    return this.placement.rowLength;
  }

  /**
   * Returns the offset change that moves a vertex by a world distance along the
   * face normal.
   *
   * @param worldDistance Distance in meters.
   * @returns Offset delta before scale.
   */
  offsetDeltaForDistance(worldDistance: number): number {
    return displacementOffsetDeltaForDistance(this.displacement, worldDistance);
  }

  /**
   * Builds the edit that stores the working copy on the brush face.
   *
   * @returns Displacement face edit.
   */
  editBuild(): DisplacementFaceEdit {
    return { target: this.target, displacement: this.displacement };
  }
}
