import * as THREE from 'three';
import { SprinklePrng } from './sprinkle_prng.js';
import type {
  SprinkleConfig,
  SprinkleSamplePoint,
  SprinkleSurfaceHit,
  SprinkleWeightedEntry,
} from './sprinkle_types.js';

/** Callback projecting a world-space ray onto scene geometry. */
export type SprinkleSurfaceRayProjector = (
  rayOrigin: THREE.Vector3,
  rayDirection: THREE.Vector3,
) => SprinkleSurfaceHit | null;

/** Computes deterministic surface scatter samples around a brush hit point. */
export class SprinkleSurfaceSampler {
  /**
   * Generates scatter sample points inside `config.radius` around `centerHit`.
   *
   * @param centerHit Brush center surface hit.
   * @param config Sprinkle scatter configuration.
   * @param entries Weighted catalog entries to pick from.
   * @param projector Raycast callback onto world surfaces (optional; falls back
   *   to tangent plane).
   * @returns Array of placed sample points.
   */
  static sampleStamp(
    centerHit: SprinkleSurfaceHit,
    config: SprinkleConfig,
    entries: readonly SprinkleWeightedEntry[],
    projector?: SprinkleSurfaceRayProjector,
  ): SprinkleSamplePoint[] {
    if (config.mode === 'SUBTRACTIVE' || config.density <= 0 || config.radius <= 0) {
      return [];
    }
    const prng = new SprinklePrng(config.seed);
    const { tangentU, tangentV } = SprinkleSurfaceSampler.buildTangentBasis(centerHit.normal);
    const results: SprinkleSamplePoint[] = [];
    const count = Math.max(1, Math.round(config.density));
    for (let i = 0; i < count; i++) {
      const sample = SprinkleSurfaceSampler.buildOneSample(
        centerHit,
        tangentU,
        tangentV,
        config,
        entries,
        prng,
        projector,
      );
      if (sample) results.push(sample);
    }
    return results;
  }

  /**
   * Filters existing objects whose world position lies within `radius` of
   * `center`.
   *
   * @param center World-space brush center.
   * @param radius Brush radius in meters.
   * @param objects Candidate objects in the scene.
   * @returns Objects within the brush sphere.
   */
  static collectObjectsInRadius(
    center: THREE.Vector3,
    radius: number,
    objects: readonly THREE.Object3D[],
  ): THREE.Object3D[] {
    const radiusSq = radius * radius;
    const worldPos = new THREE.Vector3();
    return objects.filter((obj) => {
      obj.getWorldPosition(worldPos);
      return worldPos.distanceToSquared(center) <= radiusSq;
    });
  }

  /**
   * Builds one scatter sample point using the seeded PRNG.
   *
   * @param centerHit Brush center hit.
   * @param tangentU Unit tangent U.
   * @param tangentV Unit tangent V.
   * @param config Sprinkle config.
   * @param entries Weighted entries.
   * @param prng Seeded PRNG.
   * @param projector Optional surface raycast callback.
   * @returns Sample point, or null when ray projection misses.
   */
  private static buildOneSample(
    centerHit: SprinkleSurfaceHit,
    tangentU: THREE.Vector3,
    tangentV: THREE.Vector3,
    config: SprinkleConfig,
    entries: readonly SprinkleWeightedEntry[],
    prng: SprinklePrng,
    projector?: SprinkleSurfaceRayProjector,
  ): SprinkleSamplePoint | null {
    const entryId = prng.pickWeighted(entries);
    const offset = SprinkleSurfaceSampler.sampleDiskOffset(config, prng);
    const hit = entryId
      ? SprinkleSurfaceSampler.projectOffsetToSurface(centerHit, tangentU, tangentV, offset, config.radius, projector)
      : null;
    if (!entryId || !hit) return null;
    const uniformScale = prng.range(config.scaleMin, config.scaleMax);
    return {
      entryId,
      position: hit.point.clone(),
      quaternion: SprinkleSurfaceSampler.computeOrientation(hit.normal, config, prng),
      scale: new THREE.Vector3(uniformScale, uniformScale, uniformScale),
    };
  }

  /**
   * Samples a 2D offset `(du, dv)` inside the circle of `config.radius`,
   * snapped to `gridStepX` / `gridStepZ` when configured.
   *
   * @param config Sprinkle configuration.
   * @param prng Seeded PRNG.
   * @returns 2D tangent offset.
   */
  private static sampleDiskOffset(config: SprinkleConfig, prng: SprinklePrng): THREE.Vector2 {
    const angle = prng.nextFloat() * Math.PI * 2;
    const dist = Math.sqrt(prng.nextFloat()) * config.radius;
    let du = Math.cos(angle) * dist;
    let dv = Math.sin(angle) * dist;
    if (config.gridStepX > 0) {
      du = Math.round(du / config.gridStepX) * config.gridStepX;
    }
    if (config.gridStepZ > 0) {
      dv = Math.round(dv / config.gridStepZ) * config.gridStepZ;
    }
    return new THREE.Vector2(du, dv);
  }

  /**
   * Projects a 2D tangent offset onto the scene surface or tangent plane.
   *
   * @param centerHit Center surface hit.
   * @param tangentU Unit tangent U.
   * @param tangentV Unit tangent V.
   * @param offset 2D offset in tangent plane.
   * @param radius Brush radius used for ray elevation.
   * @param projector Optional surface raycast callback.
   * @returns Projected surface hit, or null.
   */
  private static projectOffsetToSurface(
    centerHit: SprinkleSurfaceHit,
    tangentU: THREE.Vector3,
    tangentV: THREE.Vector3,
    offset: THREE.Vector2,
    radius: number,
    projector?: SprinkleSurfaceRayProjector,
  ): SprinkleSurfaceHit | null {
    const planePoint = centerHit.point.clone().addScaledVector(tangentU, offset.x).addScaledVector(tangentV, offset.y);
    if (!projector) {
      return { point: planePoint, normal: centerHit.normal.clone() };
    }
    const rayOrigin = planePoint.clone().addScaledVector(centerHit.normal, Math.max(1, radius));
    const rayDir = centerHit.normal.clone().negate();
    return projector(rayOrigin, rayDir);
  }

  /**
   * Computes the sample orientation from surface normal alignment and random
   * yaw.
   *
   * @param normal Surface unit normal.
   * @param config Sprinkle config.
   * @param prng Seeded PRNG.
   * @returns World orientation quaternion.
   */
  private static computeOrientation(
    normal: THREE.Vector3,
    config: SprinkleConfig,
    prng: SprinklePrng,
  ): THREE.Quaternion {
    const up = new THREE.Vector3(0, 1, 0);
    const alignQuat = new THREE.Quaternion();
    if (config.alignToNormal) {
      alignQuat.setFromUnitVectors(up, normal.clone().normalize());
    }
    const yawAngle = config.randomYaw ? prng.nextFloat() * Math.PI * 2 : 0;
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(up, yawAngle);
    return alignQuat.multiply(yawQuat);
  }

  /**
   * Builds an orthonormal tangent basis `(tangentU, tangentV)` perpendicular to
   * `normal`.
   *
   * @param normal Unit surface normal.
   * @returns Orthonormal tangent vectors.
   */
  private static buildTangentBasis(normal: THREE.Vector3): {
    tangentU: THREE.Vector3;
    tangentV: THREE.Vector3;
  } {
    const n = normal.clone().normalize();
    const helper = Math.abs(n.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const tangentU = new THREE.Vector3().crossVectors(helper, n).normalize();
    const tangentV = new THREE.Vector3().crossVectors(n, tangentU).normalize();
    return { tangentU, tangentV };
  }
}
