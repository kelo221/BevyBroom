import type * as THREE from 'three';
import { SolidModel } from '@/solid/model/solid_model.js';
import {
  DISPLACEMENT_COLLISION_FLAG_KEYS,
  type DisplacementCollisionFlags,
} from '@/displacement/model/displacement_types.js';
import { displacementCollisionFlagsAnySet } from '@/displacement/model/displacement_collision_flags.js';
import { displacementSurfaceMeshIdentityRead } from '@/displacement/mesh/displacement_surface_mesh_keys.js';

/** GLB node extras key carrying the collision flags of a displacement surface. */
export const DISPLACEMENT_EXPORT_COLLISION_EXTRAS_KEY = 'broom_displacement';

/**
 * Collision flags of a displacement surface as the game reads them from node
 * extras.
 */
export interface DisplacementExportCollisionExtras {
  /** The surface has no physics collision. */
  no_physics_collision: boolean;
  /** The surface does not block hulls. */
  no_hull_collision: boolean;
  /** The surface does not block rays. */
  no_ray_collision: boolean;
  /** The surface seals the level. */
  seals: boolean;
}

/** Extras field name of every editor collision flag key. */
const DISPLACEMENT_EXPORT_COLLISION_EXTRAS_FIELDS: Readonly<
  Record<keyof DisplacementCollisionFlags, keyof DisplacementExportCollisionExtras>
> = {
  noPhysicsCollision: 'no_physics_collision',
  noHullCollision: 'no_hull_collision',
  noRayCollision: 'no_ray_collision',
  seals: 'seals',
};

/**
 * Builds the collision extras the game reads from exported displacement surface
 * nodes.
 */
export class DisplacementExportCollisionExtrasBuilder {
  /**
   * Converts collision flags to their extras form.
   *
   * @param flags Collision flags of one displacement surface.
   * @returns Extras with every flag, or null when no flag is set.
   */
  static extrasFromFlags(flags: Readonly<DisplacementCollisionFlags>): DisplacementExportCollisionExtras | null {
    if (!displacementCollisionFlagsAnySet(flags)) {
      return null;
    }
    const extras: DisplacementExportCollisionExtras = {
      no_physics_collision: false,
      no_hull_collision: false,
      no_ray_collision: false,
      seals: false,
    };
    DISPLACEMENT_COLLISION_FLAG_KEYS.forEach((key) => {
      extras[DISPLACEMENT_EXPORT_COLLISION_EXTRAS_FIELDS[key]] = flags[key];
    });
    return extras;
  }

  /**
   * Returns the collision extras of a live displacement surface mesh, read from
   * the brush face it shows.
   *
   * @param surfaceMesh Live scene object, normally a displacement surface mesh
   *   under its solid model root.
   * @returns Extras, or null when the object is no displacement surface or no
   *   flag is set.
   */
  static extrasOfSurfaceMesh(surfaceMesh: THREE.Object3D): DisplacementExportCollisionExtras | null {
    const flags = DisplacementExportCollisionExtrasBuilder.surfaceFlagsRead(surfaceMesh);
    return flags === null ? null : DisplacementExportCollisionExtrasBuilder.extrasFromFlags(flags);
  }

  /**
   * Writes the collision extras of a live displacement surface mesh onto its
   * export node.
   *
   * @param surfaceMesh Live scene object.
   * @param target Export node whose userData becomes glTF extras.
   */
  static extrasWrite(surfaceMesh: THREE.Object3D, target: THREE.Object3D): void {
    const extras = DisplacementExportCollisionExtrasBuilder.extrasOfSurfaceMesh(surfaceMesh);
    if (extras !== null) {
      target.userData[DISPLACEMENT_EXPORT_COLLISION_EXTRAS_KEY] = extras;
    }
  }

  /**
   * Reads the collision flags of the brush face a displacement surface mesh
   * shows.
   *
   * @param surfaceMesh Live scene object.
   * @returns Flags, or null when the object is no displacement surface or its
   *   brush face has no displacement.
   */
  private static surfaceFlagsRead(surfaceMesh: THREE.Object3D): Readonly<DisplacementCollisionFlags> | null {
    const identity = displacementSurfaceMeshIdentityRead(surfaceMesh);
    const solidRoot = surfaceMesh.parent;
    if (identity === null || solidRoot === null) {
      return null;
    }
    const brush = SolidModel.fromObject(solidRoot)?.findBrush(identity.brushId);
    return brush?.faceDisplacementRead(identity.surfaceIndex)?.flags ?? null;
  }
}
