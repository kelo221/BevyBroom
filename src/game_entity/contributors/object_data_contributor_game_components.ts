import type * as THREE from 'three';
import type { ExportSceneOptions } from '@/io/scene/builder_export_scene.js';
import type { ObjectEntry, SceneJSON } from '@/io/scene/io_types.js';
import { GameEntityClassProviderScene } from '@/game_entity/class/game_entity_class_provider_scene.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { type GameEntityClass, gameEntityClassFromUnknown } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { ObjectDataContributor } from '@/object_data/object_data_contributor.js';
import type { PreviewAuthoredObject } from '@/preview/protocol/preview_protocol_types.js';

/** GLB extras key carrying an exported node's game components. */
export const GAME_ENTITY_EXPORT_EXTRAS_KEY = 'broom_components';

/**
 * Carries game components through scene files, the game preview and GLB export,
 * and saves a snapshot of the classes a document uses.
 */
export class ObjectDataContributorGameComponents extends ObjectDataContributor {
  readonly contributorName = 'game_components';

  /**
   * Stores an object's component overrides in its scene entry.
   *
   * @param object Live scene object.
   * @param entry Entry being written.
   */
  override sceneEntryWrite(object: THREE.Object3D, entry: ObjectEntry): void {
    if (GameEntityComponentStore.hasAny(object)) {
      entry.gameComponents = GameEntityComponentStore.read(object);
    }
  }

  /**
   * Restores an object's component overrides from its scene entry.
   *
   * @param entry Entry being read.
   * @param object Object just created from the entry.
   */
  override sceneEntryRead(entry: ObjectEntry, object: THREE.Object3D): void {
    if (entry.gameComponents !== undefined) {
      GameEntityComponentStore.write(object, GameEntityComponentStore.fromUnknown(entry.gameComponents));
    }
  }

  /**
   * Saves the classes of every component the document uses.
   *
   * @param worldGroup Live world root.
   * @param scene Scene file being written.
   */
  override sceneDocumentWrite(worldGroup: THREE.Object3D, scene: SceneJSON): void {
    const classes = [...ObjectDataContributorGameComponents.typePathsUsed(worldGroup)]
      .map((typePath) => GameEntityClassRegistry.classFind(typePath))
      .filter((gameClass): gameClass is GameEntityClass => gameClass !== null);
    if (classes.length > 0) {
      scene.gameClasses = classes;
    }
  }

  /**
   * Shows the class snapshot of the document being opened.
   *
   * @param scene Scene file being read.
   */
  override sceneDocumentRead(scene: SceneJSON): void {
    const classes = (scene.gameClasses ?? [])
      .map(gameEntityClassFromUnknown)
      .filter((gameClass): gameClass is GameEntityClass => gameClass !== null);
    GameEntityClassProviderScene.shared.listWrite({ generation: 0, asset_generation: 0, classes, asset_types: [] });
  }

  /**
   * Gives a duplicate its own copy of the source's component overrides.
   *
   * @param source Duplicated object.
   * @param copy The new duplicate.
   */
  override duplicateDataCopy(source: THREE.Object3D, copy: THREE.Object3D): void {
    GameEntityComponentStore.write(copy, GameEntityComponentStore.read(source));
  }

  /**
   * Sends an object's component overrides to the game.
   *
   * @param object Live scene object.
   * @param authored Preview object being built.
   */
  override previewPayloadAttach(object: THREE.Object3D, authored: PreviewAuthoredObject): void {
    if (GameEntityComponentStore.hasAny(object)) {
      authored.components = GameEntityComponentStore.read(object);
    }
  }

  /**
   * Exports a game entity as an empty node when game components are exported.
   *
   * @param owner Entity owner.
   * @param options Export behavior switches.
   * @returns No children for game entities, or null for other owners.
   */
  override exportEntityChildrenCreate(owner: THREE.Object3D, options: ExportSceneOptions): THREE.Object3D[] | null {
    return options.includeGameComponents === true && GameEntityOwner.isOwner(owner) ? [] : null;
  }

  /**
   * Writes an object's component overrides into its export extras.
   *
   * @param source Live scene object.
   * @param target Export node.
   * @param options Export behavior switches.
   */
  override exportExtrasWrite(source: THREE.Object3D, target: THREE.Object3D, options: ExportSceneOptions): void {
    if (options.includeGameComponents === true && GameEntityComponentStore.hasAny(source)) {
      target.userData[GAME_ENTITY_EXPORT_EXTRAS_KEY] = GameEntityComponentStore.read(source);
    }
  }

  /**
   * Collects the type path of every component attached under a root.
   *
   * @param root Scene root.
   * @returns Unique type paths.
   */
  private static typePathsUsed(root: THREE.Object3D): Set<string> {
    const typePaths = new Set<string>();
    root.traverse((object) => {
      Object.keys(GameEntityComponentStore.read(object)).forEach((typePath) => typePaths.add(typePath));
    });
    return typePaths;
  }
}
