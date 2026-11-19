import * as THREE from 'three';
import { EntityVisualBuilder } from '@/entity/visual/entity_visual_builder.js';
import { GameEntityModelLibrary } from '@/game_entity/model/game_entity_model_library.js';
import { shadingExemptFlag } from '@/viewports/shading/shading_exempt.js';

/** Name of the model a game entity marker draws. */
export const GAME_ENTITY_MARKER_MODEL_NAME = 'Game Entity Model';

/** UserData key on the drawn model holding the path it was loaded from. */
const GAME_ENTITY_MARKER_MODEL_PATH_KEY = 'gameEntityModelPath';

/**
 * UserData key on the drawn model holding the library reader epoch it was
 * loaded in.
 */
const GAME_ENTITY_MARKER_MODEL_EPOCH_KEY = 'gameEntityModelEpoch';

/**
 * Draws the model a game entity's marker box names at the entity's origin, as
 * an editor-only part that is never picked, saved or exported.
 */
export class GameEntityVisualMarkerModel {
  /**
   * Makes the owner draw the model of a path, or no model. A model of the same
   * path loaded through an older reader stays drawn until the new one is
   * ready.
   *
   * @param owner Game entity owner group.
   * @param modelPath Model path relative to the asset root, or null for none.
   * @param library Library the model is taken from.
   */
  static apply(
    owner: THREE.Object3D,
    modelPath: string | null,
    library: GameEntityModelLibrary = GameEntityModelLibrary.shared,
  ): void {
    const current = GameEntityVisualMarkerModel.find(owner);
    const isCurrentPath = current !== null && current.userData[GAME_ENTITY_MARKER_MODEL_PATH_KEY] === modelPath;
    if (isCurrentPath && current.userData[GAME_ENTITY_MARKER_MODEL_EPOCH_KEY] === library.readerEpoch()) {
      return;
    }
    const template = modelPath === null ? null : library.templateRead(modelPath);
    if (template === null && isCurrentPath) {
      return;
    }
    if (current !== null) {
      owner.remove(current);
    }
    if (modelPath !== null && template !== null) {
      owner.add(GameEntityVisualMarkerModel.instanceCreate(template, modelPath, library.readerEpoch()));
    }
  }

  /**
   * Returns the model the owner draws.
   *
   * @param owner Game entity owner group.
   * @returns Drawn model, or null when the owner draws none.
   */
  static find(owner: THREE.Object3D): THREE.Object3D | null {
    return owner.children.find((child) => child.name === GAME_ENTITY_MARKER_MODEL_NAME) ?? null;
  }

  /**
   * Creates a copy of a loaded model flagged as an editor-only part with its
   * own materials.
   *
   * @param template Loaded model shared by every entity.
   * @param modelPath Path the model was loaded from.
   * @param readerEpoch Library reader epoch the model was loaded in.
   * @returns Model copy.
   */
  private static instanceCreate(template: THREE.Group, modelPath: string, readerEpoch: number): THREE.Object3D {
    const instance = template.clone(true);
    instance.name = GAME_ENTITY_MARKER_MODEL_NAME;
    instance.userData = {
      [GAME_ENTITY_MARKER_MODEL_PATH_KEY]: modelPath,
      [GAME_ENTITY_MARKER_MODEL_EPOCH_KEY]: readerEpoch,
    };
    EntityVisualBuilder.partPersistentFlag(instance);
    instance.traverse((part) => GameEntityVisualMarkerModel.partPrepare(part));
    return instance;
  }

  /**
   * Flags one object of a model copy as a visual part that keeps its own
   * material, giving meshes materials of their own.
   *
   * @param part Object of the model copy.
   */
  private static partPrepare(part: THREE.Object3D): void {
    EntityVisualBuilder.partFlag(part);
    shadingExemptFlag(part);
    if (part instanceof THREE.Mesh) {
      part.material = Array.isArray(part.material)
        ? part.material.map((material: THREE.Material) => material.clone())
        : part.material.clone();
    }
  }
}
