import type * as THREE from 'three';
import type { ObjectEntry, SceneJSON } from '@/io/scene/io_types.js';
import type { ExportSceneOptions } from '@/io/scene/builder_export_scene.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GAME_ENTITY_EXPORT_EXTRAS_KEY } from '@/game_entity/contributors/object_data_contributor_game_components.js';
import { GameEntityComponentNormalizer } from '@/game_entity/migration/game_entity_component_normalizer.js';
import { GameEntityComponentRewriteLog } from '@/game_entity/migration/game_entity_component_rewrite_log.js';
import { ObjectDataContributor } from '@/object_data/object_data_contributor.js';
import type { PreviewAuthoredObject } from '@/preview/protocol/preview_protocol_types.js';

/**
 * Brings game components up to the current classes wherever they enter or leave
 * the editor: objects loaded or pasted are rewritten and every change is
 * remembered for the Issues list, and saved files, the game preview and exports
 * always carry current names with every enum value written out. Runs after the
 * game components contributor, whose data it rewrites.
 */
export class ObjectDataContributorComponentNormalize extends ObjectDataContributor {
  readonly contributorName = 'game_component_normalize';

  /**
   * Forgets the changes made to the level loaded before.
   *
   * @param _scene Scene being read.
   */
  override sceneDocumentRead(_scene: SceneJSON): void {
    GameEntityComponentRewriteLog.clear();
  }

  /**
   * Rewrites the components of a loaded or pasted object and remembers the
   * changes.
   *
   * @param _entry Scene entry being read.
   * @param object Created scene object, already holding its components.
   */
  override sceneEntryRead(_entry: ObjectEntry, object: THREE.Object3D): void {
    if (!GameEntityComponentStore.hasAny(object)) {
      return;
    }
    const normalization = GameEntityComponentNormalizer.current().normalize(GameEntityComponentStore.read(object));
    if (normalization.rewrites.length > 0) {
      GameEntityComponentStore.write(object, normalization.components);
      GameEntityComponentRewriteLog.record(object, normalization.rewrites);
    }
  }

  /**
   * Saves the object's components with current names and every enum value.
   *
   * @param object Live scene object.
   * @param entry Scene entry being written, already holding the components.
   */
  override sceneEntryWrite(object: THREE.Object3D, entry: ObjectEntry): void {
    if (entry.gameComponents !== undefined) {
      entry.gameComponents = ObjectDataContributorComponentNormalize.componentsCurrentOf(object);
    }
  }

  /**
   * Sends the game the object's components with current names and every enum
   * value.
   *
   * @param object Live scene object.
   * @param authored Authored object being sent, already holding the components.
   */
  override previewPayloadAttach(object: THREE.Object3D, authored: PreviewAuthoredObject): void {
    if (authored.components !== undefined) {
      authored.components = ObjectDataContributorComponentNormalize.componentsCurrentOf(object);
    }
  }

  /**
   * Exports the object's components with current names and every enum value.
   *
   * @param source Live scene object.
   * @param target Export node, already holding the components.
   * @param _options Export behavior switches.
   */
  override exportExtrasWrite(source: THREE.Object3D, target: THREE.Object3D, _options: ExportSceneOptions): void {
    if (target.userData[GAME_ENTITY_EXPORT_EXTRAS_KEY] !== undefined) {
      target.userData[GAME_ENTITY_EXPORT_EXTRAS_KEY] =
        ObjectDataContributorComponentNormalize.componentsCurrentOf(source);
    }
  }

  /**
   * Returns an object's components brought up to the current classes.
   *
   * @param object Scene object.
   * @returns Normalized components; the object is left alone.
   */
  private static componentsCurrentOf(object: THREE.Object3D): ReturnType<typeof GameEntityComponentStore.read> {
    return GameEntityComponentNormalizer.current().normalize(GameEntityComponentStore.read(object)).components;
  }
}
