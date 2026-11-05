import type * as THREE from 'three';
import type { ExportSceneOptions } from '@/io/scene/builder_export_scene.js';
import type { ObjectEntry } from '@/io/scene/io_types.js';
import { ObjectDataContributor } from '@/object_data/object_data_contributor.js';
import type { PreviewAuthoredObject } from '@/preview/protocol/preview_protocol_types.js';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import { GAME_ENTITY_LOGIC_EXPORT_EXTRAS_KEY } from '@/game_entity/logic/game_entity_logic_types.js';

/**
 * Carries entity I/O output connections (`gameLogicOutputs` / `broom_logic`)
 * and object comments through scene persistence, duplication, live preview, and
 * GLB export.
 */
export class ObjectDataContributorGameLogic extends ObjectDataContributor {
  readonly contributorName = 'game_logic';

  /**
   * Writes an object's logic outputs and comments into its scene file entry.
   *
   * @param object Live scene object.
   * @param entry Scene entry being written.
   */
  override sceneEntryWrite(object: THREE.Object3D, entry: ObjectEntry): void {
    if (GameEntityLogicStore.hasAny(object)) {
      entry.gameLogicOutputs = GameEntityLogicStore.read(object);
    }
    const comments = GameEntityLogicStore.commentsRead(object);
    if (comments) {
      entry.objectComments = comments;
    }
  }

  /**
   * Restores an object's logic outputs and comments from its scene file entry.
   *
   * @param entry Scene entry being read.
   * @param object Created scene object.
   */
  override sceneEntryRead(entry: ObjectEntry, object: THREE.Object3D): void {
    if (entry.gameLogicOutputs !== undefined) {
      GameEntityLogicStore.write(object, GameEntityLogicStore.fromUnknown(entry.gameLogicOutputs));
    }
    if (typeof entry.objectComments === 'string') {
      GameEntityLogicStore.commentsWrite(object, entry.objectComments);
    }
  }

  /**
   * Copies logic outputs and comments onto a duplicated object.
   *
   * @param source Source object.
   * @param copy Duplicated object.
   */
  override duplicateDataCopy(source: THREE.Object3D, copy: THREE.Object3D): void {
    GameEntityLogicStore.write(copy, GameEntityLogicStore.read(source));
    GameEntityLogicStore.commentsWrite(copy, GameEntityLogicStore.commentsRead(source));
  }

  /**
   * Attaches logic outputs to the live preview payload.
   *
   * @param object Live scene object.
   * @param authored Preview object payload.
   */
  override previewPayloadAttach(object: THREE.Object3D, authored: PreviewAuthoredObject): void {
    if (GameEntityLogicStore.hasAny(object)) {
      authored.logic_outputs = GameEntityLogicStore.read(object);
    }
  }

  /**
   * Writes `broom_logic` into the exported GLB node extras when game components
   * are included.
   *
   * @param source Live scene object.
   * @param target Export node.
   * @param options Export options.
   */
  override exportExtrasWrite(source: THREE.Object3D, target: THREE.Object3D, options: ExportSceneOptions): void {
    if (options.includeGameComponents === true && GameEntityLogicStore.hasAny(source)) {
      target.userData[GAME_ENTITY_LOGIC_EXPORT_EXTRAS_KEY] = GameEntityLogicStore.read(source);
    }
  }
}
