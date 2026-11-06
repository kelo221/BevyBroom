import type * as THREE from 'three';
import { DisplacementExportCollisionExtrasBuilder } from '@/displacement/export/displacement_export_collision_extras.js';
import { ObjectDataContributor } from '@/object_data/object_data_contributor.js';

/**
 * Exports the collision flags of displacement surfaces as node extras the game
 * reads.
 */
export class ObjectDataContributorDisplacementCollision extends ObjectDataContributor {
  readonly contributorName = 'displacement_collision';

  /**
   * Writes the collision flags of a displacement surface mesh into its export
   * extras when any flag is set.
   *
   * @param source Live scene object.
   * @param target Export node.
   */
  override exportExtrasWrite(source: THREE.Object3D, target: THREE.Object3D): void {
    DisplacementExportCollisionExtrasBuilder.extrasWrite(source, target);
  }
}
