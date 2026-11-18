import * as THREE from 'three';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import type { CollisionModelResult } from '@/level_export/collision/collision_model_result.js';
import { CollisionSolidModelCollector } from '@/level_export/collision/collision_solid_model_collector.js';
import { CollisionMeshCollector } from '@/level_export/collision/mesh/collision_mesh_collector.js';
import {
  COLLISION_FILE_VERSION,
  type CollisionDocument,
  type CollisionFlaggedRecord,
  type CollisionPieceRecord,
} from '@/level_export/collision/collision_types.js';
import { CollisionKindStore } from '@/level_export/kind/collision_kind_store.js';
import { LevelExportObjectFilter } from '@/level_export/level_export_object_filter.js';
import { LevelExportPlacementsBuilder } from '@/level_export/placements/level_export_placements_builder.js';
import { SolidModel } from '@/solid/model/solid_model.js';

/** Collision of one solid model or plain mesh with its object's data. */
export interface CollisionObjectRecords {
  pieces: CollisionPieceRecord[];
  flagged: CollisionFlaggedRecord[];
}

/**
 * Builds the collision document of a level: the convex pieces and flagged parts
 * of every exported solid model and plain content mesh, each with its object's
 * name, collision kind and game components, and the placements of the objects
 * the game places.
 */
export class CollisionDocumentBuilder {
  /**
   * Builds the document of a world.
   *
   * @param worldGroup World root.
   * @param levelName Level name written into the document.
   * @returns Collision document in scene order.
   */
  static build(worldGroup: THREE.Object3D, levelName: string): CollisionDocument {
    worldGroup.updateMatrixWorld(true);
    const records = CollisionDocumentBuilder.collisionSourcesOf(worldGroup).map((source) =>
      CollisionDocumentBuilder.objectRecordsBuild(source),
    );
    return {
      collision_version: COLLISION_FILE_VERSION,
      level_name: levelName,
      pieces: records.flatMap((record) => record.pieces),
      flagged: records.flatMap((record) => record.flagged),
      placements: LevelExportPlacementsBuilder.build(worldGroup),
    };
  }

  /**
   * Builds the collision of one solid model or plain mesh with its object's
   * data.
   *
   * @param object Solid model root or plain content mesh with a current world
   *   matrix.
   * @returns Pieces and flagged parts.
   */
  static objectRecordsBuild(object: THREE.Object3D): CollisionObjectRecords {
    const collected = CollisionDocumentBuilder.objectCollisionCollect(object);
    const source = {
      object_id: object.uuid,
      object_name: object.name,
      kind: CollisionKindStore.resolve(object),
      components: GameEntityComponentResolver.componentsEffective(GameEntityComponentStore.read(object), (typePath) =>
        GameEntityClassRegistry.classFind(typePath),
      ),
    };
    return {
      pieces: collected.pieces.map((piece) => ({ ...source, ...piece })),
      flagged: collected.flagged.map((flagged) => ({ ...source, ...flagged })),
    };
  }

  /**
   * Collects the pieces and flagged parts of a solid model or a plain mesh.
   *
   * @param object Solid model root or plain content mesh.
   * @returns Collision without the object's data.
   */
  private static objectCollisionCollect(object: THREE.Object3D): CollisionModelResult {
    if (!SolidModel.isSolidModelObject(object) && object instanceof THREE.Mesh) {
      return CollisionMeshCollector.collect(object);
    }
    return CollisionSolidModelCollector.collect(object);
  }

  /**
   * Returns the exported solid model roots and plain content meshes of a world
   * in scene order.
   *
   * @param worldGroup World root.
   * @returns Objects whose collision is written.
   */
  private static collisionSourcesOf(worldGroup: THREE.Object3D): THREE.Object3D[] {
    const sources: THREE.Object3D[] = [];
    worldGroup.traverse((object) => {
      if (LevelExportObjectFilter.collisionSourceIs(object) && LevelExportObjectFilter.exportedIs(object, worldGroup)) {
        sources.push(object);
      }
    });
    return sources;
  }
}
