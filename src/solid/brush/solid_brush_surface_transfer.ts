import { SolidBrush } from './solid_brush.js';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import {
  FaceSurfaceDescription,
  cloneFaceSurface,
  createDefaultFaceSurface,
  orientDefaultFaceSurface,
} from '@/texture/uv_matrix/face_surface_description.js';
import type { DisplacementFaceSurface } from '@/displacement/model/displacement_types.js';
import { displacementSurfaceClone } from '@/displacement/model/displacement_face_surface.js';
import { displacementFaceFailureRead } from '@/displacement/model/displacement_face_eligibility.js';
import type { SolidBrushSurfaceMatcher } from './surface_matcher/solid_brush_surface_matcher.js';
import { SolidBrushSurfaceMatcherPlane } from './surface_matcher/solid_brush_surface_matcher_plane.js';

const surfaceMatcherPlane = new SolidBrushSurfaceMatcherPlane();

/** Default surface plus sparse per-face surfaces of a brush. */
export interface SolidBrushTransferredSurfaces {
  /** Surface used by faces without an override. */
  defaultSurface: FaceSurfaceDescription;
  /** Sparse per-face overrides indexed like the brush faces. */
  faceSurfaces: (FaceSurfaceDescription | undefined)[];
}

/**
 * Transfers per-face UV surfaces from a source brush onto a destination brush
 * by matching plane equations (normal + offset). Coplanar survivors keep their
 * UV matrices; unmatched faces receive a default face-oriented UV matrix.
 *
 * @param sourceBrush Geometry that owned the source surfaces.
 * @param sourceDefault Default surface on the source instance.
 * @param sourceFaceSurfaces Sparse per-face surfaces from the source instance.
 * @param destinationBrush New clipped/split geometry.
 * @returns Default surface and sparse face surfaces for the destination.
 */
export function transferSurfacesByPlaneMatch(
  sourceBrush: SolidBrush,
  sourceDefault: FaceSurfaceDescription,
  sourceFaceSurfaces: (FaceSurfaceDescription | undefined)[],
  destinationBrush: SolidBrush,
): SolidBrushTransferredSurfaces {
  return transferSurfacesByMatcher(
    surfaceMatcherPlane,
    sourceBrush,
    sourceDefault,
    sourceFaceSurfaces,
    destinationBrush,
  );
}

/**
 * Transfers per-face UV surfaces from a source brush onto a destination brush,
 * letting the matcher decide which source face each destination face inherits.
 * Matched faces without a source override stay on the default surface;
 * unmatched faces receive the default surface oriented to their normal.
 *
 * @param matcher Face matcher comparing brush-local planes.
 * @param sourceBrush Geometry that owned the source surfaces.
 * @param sourceDefault Default surface on the source instance.
 * @param sourceFaceSurfaces Sparse per-face surfaces from the source instance.
 * @param destinationBrush New geometry receiving the surfaces.
 * @returns Default surface and sparse face surfaces for the destination.
 */
export function transferSurfacesByMatcher(
  matcher: SolidBrushSurfaceMatcher,
  sourceBrush: SolidBrush,
  sourceDefault: FaceSurfaceDescription,
  sourceFaceSurfaces: (FaceSurfaceDescription | undefined)[],
  destinationBrush: SolidBrush,
): SolidBrushTransferredSurfaces {
  const defaultSurface = cloneFaceSurface(sourceDefault);
  const faceSurfaces: (FaceSurfaceDescription | undefined)[] = [];
  for (let destinationIndex = 0; destinationIndex < destinationBrush.faces.length; destinationIndex++) {
    faceSurfaces[destinationIndex] = transferredFaceSurfaceResolve(
      matcher,
      sourceBrush,
      defaultSurface,
      sourceFaceSurfaces,
      destinationBrush,
      destinationIndex,
    );
  }
  return { defaultSurface, faceSurfaces };
}

/**
 * Resolves the surface one destination face inherits.
 *
 * @param matcher Face matcher comparing brush-local planes.
 * @param sourceBrush Geometry that owned the source surfaces.
 * @param defaultSurface Destination default surface.
 * @param sourceFaceSurfaces Sparse per-face surfaces from the source instance.
 * @param destinationBrush New geometry receiving the surfaces.
 * @param destinationIndex Destination face index.
 * @returns Face override, or undefined to use the default surface.
 */
function transferredFaceSurfaceResolve(
  matcher: SolidBrushSurfaceMatcher,
  sourceBrush: SolidBrush,
  defaultSurface: FaceSurfaceDescription,
  sourceFaceSurfaces: (FaceSurfaceDescription | undefined)[],
  destinationBrush: SolidBrush,
  destinationIndex: number,
): FaceSurfaceDescription | undefined {
  const destinationPlane = destinationBrush.planes[destinationIndex];
  if (!destinationPlane) {
    return createDefaultFaceSurface(defaultSurface.textureId);
  }
  const sourceIndex = matcher.faceMatchFind(sourceBrush.planes, destinationPlane);
  if (sourceIndex < 0) {
    return orientDefaultFaceSurface(defaultSurface, destinationPlane.normal);
  }
  const override = sourceFaceSurfaces[sourceIndex];
  return override ? cloneFaceSurface(override) : undefined;
}

/**
 * Applies plane-matched surface transfer onto a brush instance after its
 * geometry has been replaced.
 *
 * @param instance Brush instance already holding the new geometry.
 * @param sourceBrush Previous geometry (for plane matching).
 * @param sourceDefault Previous default surface.
 * @param sourceFaceSurfaces Previous sparse face surfaces.
 */
export function applyTransferredSurfacesToInstance(
  instance: SolidBrushInstance,
  sourceBrush: SolidBrush,
  sourceDefault: FaceSurfaceDescription,
  sourceFaceSurfaces: (FaceSurfaceDescription | undefined)[],
): void {
  const transferred = transferSurfacesByPlaneMatch(sourceBrush, sourceDefault, sourceFaceSurfaces, instance.brush);
  instance.restoreFaceSurfaces(transferred.defaultSurface, transferred.faceSurfaces);
  applyTransferredDisplacementsToInstance(instance, sourceBrush, sourceFaceSurfaces);
}

/**
 * Moves source-face displacements onto matching destination faces and drops
 * unmatched or ineligible ones.
 *
 * @param instance Brush instance already holding the new geometry.
 * @param sourceBrush Previous geometry (for plane matching).
 * @param sourceFaceSurfaces Previous faces, including their displacements.
 */
function applyTransferredDisplacementsToInstance(
  instance: SolidBrushInstance,
  sourceBrush: SolidBrush,
  sourceFaceSurfaces: (FaceSurfaceDescription | undefined)[],
): void {
  const transferred: (DisplacementFaceSurface | undefined)[] = [];
  for (let destinationIndex = 0; destinationIndex < instance.brush.faces.length; destinationIndex++) {
    transferred[destinationIndex] = transferredDisplacementResolve(
      sourceBrush,
      sourceFaceSurfaces,
      instance.brush,
      destinationIndex,
    );
  }
  instance.restoreFaceDisplacements(transferred);
  transferredDisplacementsDropIneligible(instance);
}

/**
 * Resolves the displacement one destination face inherits.
 *
 * @param sourceBrush Geometry that owned the source surfaces.
 * @param sourceFaceSurfaces Sparse per-face surfaces from the source instance.
 * @param destinationBrush New geometry receiving the displacements.
 * @param destinationIndex Destination face index.
 * @returns Cloned displacement, or undefined when unmatched.
 */
function transferredDisplacementResolve(
  sourceBrush: SolidBrush,
  sourceFaceSurfaces: (FaceSurfaceDescription | undefined)[],
  destinationBrush: SolidBrush,
  destinationIndex: number,
): DisplacementFaceSurface | undefined {
  const destinationPlane = destinationBrush.planes[destinationIndex];
  if (!destinationPlane) {
    return undefined;
  }
  const sourceIndex = surfaceMatcherPlane.faceMatchFind(sourceBrush.planes, destinationPlane);
  const displacement = sourceIndex < 0 ? undefined : sourceFaceSurfaces[sourceIndex]?.displacement;
  return displacement ? displacementSurfaceClone(displacement) : undefined;
}

/**
 * Removes transferred displacements from faces that cannot carry them.
 *
 * @param instance Brush instance whose displacements were just remapped.
 */
function transferredDisplacementsDropIneligible(instance: SolidBrushInstance): void {
  for (const faceIndex of instance.faceDisplacementIndices()) {
    if (displacementFaceFailureRead(instance, faceIndex) !== null) {
      instance.faceDisplacementWrite(faceIndex, null);
    }
  }
}

/**
 * Captures default + sparse face surfaces from an instance for clip/split undo.
 *
 * @param instance Brush instance.
 * @returns Serializable surface snapshot.
 */
export function captureInstanceFaceSurfaces(instance: SolidBrushInstance): {
  defaultSurface: ReturnType<SolidBrushInstance['serializeDefaultSurface']>;
  faceSurfaces: ReturnType<SolidBrushInstance['serializeFaceSurfaces']>;
  faceDisplacements: ReturnType<SolidBrushInstance['serializeFaceDisplacements']>;
} {
  return {
    defaultSurface: instance.serializeDefaultSurface(),
    faceSurfaces: instance.serializeFaceSurfaces(),
    faceDisplacements: instance.serializeFaceDisplacements(),
  };
}
