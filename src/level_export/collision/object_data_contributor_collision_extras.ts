import type * as THREE from 'three';
import type { ExportSceneOptions } from '@/io/scene/builder_export_scene.js';
import { CollisionDocumentBuilder } from '@/level_export/collision/collision_document_builder.js';
import { CollisionKindStore } from '@/level_export/kind/collision_kind_store.js';
import { LevelExportObjectFilter } from '@/level_export/level_export_object_filter.js';
import { ObjectDataContributor } from '@/object_data/object_data_contributor.js';

/** GLB extras key carrying a solid model's or plain mesh's collision pieces. */
export const COLLISION_EXPORT_EXTRAS_KEY = 'broom_collision';

/**
 * Writes the collision of every solid model and plain content mesh onto its
 * export node, for games that read only the GLB: the kind, the convex pieces
 * and the flagged parts, in world space, the same records `collision.json`
 * holds.
 */
export class ObjectDataContributorCollisionExtras extends ObjectDataContributor {
  readonly contributorName = 'collision_extras';

  /**
   * Writes a solid model's or plain content mesh's collision into its export
   * extras when the export asks for collision.
   *
   * @param source Live scene object.
   * @param target Export node.
   * @param options Export behavior switches.
   */
  override exportExtrasWrite(source: THREE.Object3D, target: THREE.Object3D, options: ExportSceneOptions): void {
    if (options.includeCollision !== true || !LevelExportObjectFilter.collisionSourceIs(source)) {
      return;
    }
    source.updateMatrixWorld(true);
    const records = CollisionDocumentBuilder.objectRecordsBuild(source);
    target.userData[COLLISION_EXPORT_EXTRAS_KEY] = {
      kind: CollisionKindStore.resolve(source),
      pieces: records.pieces.map(({ brush_id, planes, vertices }) => ({ brush_id, planes, vertices })),
      flagged: records.flagged.map(({ brush_id, reason, vertices, triangles }) => ({
        brush_id,
        reason,
        vertices,
        triangles,
      })),
    };
  }
}
