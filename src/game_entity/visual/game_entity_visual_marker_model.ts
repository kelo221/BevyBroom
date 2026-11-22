import * as THREE from 'three';
import { EntityVisualBuilder } from '@/entity/visual/entity_visual_builder.js';
import type { GameEntityMarkerBox } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityModelLibrary } from '@/game_entity/model/game_entity_model_library.js';
import { shadingExemptFlag, shadingLitIncludedFlag } from '@/viewports/shading/shading_exempt.js';
import { invalidateSharedShadingPass } from '@/viewports/shared/shared_shading_pass.js';

/**
 * Shortest model edge stretched, in meters, so flat models never divide by
 * zero.
 */
const GAME_ENTITY_MARKER_MODEL_MIN_EDGE = new THREE.Vector3(1e-4, 1e-4, 1e-4);

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
 * UserData key on the drawn model holding the bounds the model has at its own
 * size, as min and max corners.
 */
const GAME_ENTITY_MARKER_MODEL_NATURAL_BOUNDS_KEY = 'gameEntityModelNaturalBounds';

/**
 * Draws the model a game entity's marker box names, stretched per axis to fill
 * its box exactly, as an editor-only part that is never picked, saved or
 * exported.
 */
export class GameEntityVisualMarkerModel {
  /**
   * Stretches the drawn model, per axis, so its bounds fill a marker box
   * exactly; the game fills the box the same way.
   *
   * @param owner Game entity owner group.
   * @param markerBox Box the model fills, or null to leave the model at its own
   *   size and place.
   */
  static fit(owner: THREE.Object3D, markerBox: GameEntityMarkerBox | null): void {
    const model = GameEntityVisualMarkerModel.find(owner);
    const natural = model === null ? null : GameEntityVisualMarkerModel.naturalBoundsRead(model);
    if (model === null || natural === null) {
      return;
    }
    if (markerBox === null) {
      model.scale.set(1, 1, 1);
      model.position.set(0, 0, 0);
      return;
    }
    const naturalSize = natural.getSize(new THREE.Vector3());
    const scale = new THREE.Vector3(...markerBox.size).divide(naturalSize.max(GAME_ENTITY_MARKER_MODEL_MIN_EDGE));
    const naturalCenter = natural.getCenter(new THREE.Vector3()).multiply(scale);
    model.scale.copy(scale);
    model.position.copy(new THREE.Vector3(...markerBox.offset).sub(naturalCenter));
  }

  /**
   * Returns the bounds a drawn model has at its own size.
   *
   * @param model Drawn model.
   * @returns Bounds, or null when the model has no geometry.
   */
  private static naturalBoundsRead(model: THREE.Object3D): THREE.Box3 | null {
    const corners: unknown = model.userData[GAME_ENTITY_MARKER_MODEL_NATURAL_BOUNDS_KEY];
    if (!Array.isArray(corners) || corners.length !== 6) {
      return null;
    }
    const [minX, minY, minZ, maxX, maxY, maxZ] = corners as number[];
    return new THREE.Box3(new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(maxX, maxY, maxZ));
  }

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
      invalidateSharedShadingPass();
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
    instance.updateMatrixWorld(true);
    const natural = new THREE.Box3().setFromObject(instance);
    if (!natural.isEmpty()) {
      instance.userData[GAME_ENTITY_MARKER_MODEL_NATURAL_BOUNDS_KEY] = [
        ...natural.min.toArray(),
        ...natural.max.toArray(),
      ];
    }
    return instance;
  }

  /**
   * Flags one object of a model copy as a visual part that keeps its own
   * material except in the Lit mode, giving meshes materials of their own.
   *
   * @param part Object of the model copy.
   */
  private static partPrepare(part: THREE.Object3D): void {
    EntityVisualBuilder.partFlag(part);
    shadingExemptFlag(part);
    shadingLitIncludedFlag(part);
    if (part instanceof THREE.Mesh) {
      part.material = Array.isArray(part.material)
        ? part.material.map((material: THREE.Material) => material.clone())
        : part.material.clone();
    }
  }
}
