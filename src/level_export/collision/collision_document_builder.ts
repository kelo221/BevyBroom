import type * as THREE from 'three';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { CollisionSolidModelCollector } from '@/level_export/collision/collision_solid_model_collector.js';
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

/** Collision of one solid model with its object's data. */
export interface CollisionObjectRecords {
  pieces: CollisionPieceRecord[];
  flagged: CollisionFlaggedRecord[];
}

/**
 * Builds the collision document of a level: the convex pieces and flagged parts
 * of every exported solid model, each with its object's name, collision kind
 * and game components, and the placements of the objects the game places.
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
    const records = CollisionDocumentBuilder.solidRootsOf(worldGroup).map((root) =>
      CollisionDocumentBuilder.objectRecordsBuild(root),
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
   * Builds the collision of one solid model with its object's data.
   *
   * @param solidRoot Solid model root with a current world matrix.
   * @returns Pieces and flagged parts.
   */
  static objectRecordsBuild(solidRoot: THREE.Object3D): CollisionObjectRecords {
    const collected = CollisionSolidModelCollector.collect(solidRoot);
    const source = {
      object_id: solidRoot.uuid,
      object_name: solidRoot.name,
      kind: CollisionKindStore.resolve(solidRoot),
      components: GameEntityComponentResolver.componentsEffective(
        GameEntityComponentStore.read(solidRoot),
        (typePath) => GameEntityClassRegistry.classFind(typePath),
      ),
    };
    return {
      pieces: collected.pieces.map((piece) => ({ ...source, ...piece })),
      flagged: collected.flagged.map((flagged) => ({ ...source, ...flagged })),
    };
  }

  /**
   * Returns the exported solid model roots of a world in scene order.
   *
   * @param worldGroup World root.
   * @returns Solid model roots.
   */
  private static solidRootsOf(worldGroup: THREE.Object3D): THREE.Object3D[] {
    const roots: THREE.Object3D[] = [];
    worldGroup.traverse((object) => {
      if (SolidModel.isSolidModelObject(object) && LevelExportObjectFilter.exportedIs(object, worldGroup)) {
        roots.push(object);
      }
    });
    return roots;
  }
}
