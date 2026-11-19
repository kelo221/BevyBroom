import * as THREE from 'three';
import { GameEntityModelLibrary } from '@/game_entity/model/game_entity_model_library.js';
import { GameEntityVisualBuilder } from '@/game_entity/visual/game_entity_visual_builder.js';
import { GameEntityVisualMarkerBox } from '@/game_entity/visual/game_entity_visual_marker_box.js';
import { GameEntityVisualMarkerModel } from '@/game_entity/visual/game_entity_visual_marker_model.js';

/** What the read_game_entity_model tool reports about one game entity. */
export interface EditorApiGameEntityModelReport {
  id: string;
  name: string;
  /** Model path the entity's marker box names, or null when it names none. */
  model: string | null;
  /** Whether the model is drawn right now. */
  isDrawn: boolean;
  /** Why the model could not be loaded, or null. */
  failure: string | null;
  /**
   * Edge lengths of the drawn model in the entity's own space, or null when
   * none is drawn.
   */
  size: [number, number, number] | null;
}

/**
 * Brings a game entity's marker up to date and describes the model it draws.
 *
 * @param owner Game entity owner group.
 * @returns Model report.
 */
export function editorApiGameEntityModelReport(owner: THREE.Object3D): EditorApiGameEntityModelReport {
  GameEntityVisualBuilder.refresh(owner);
  const modelPath = GameEntityVisualMarkerBox.boxOf(owner)?.model ?? null;
  const drawnModel = GameEntityVisualMarkerModel.find(owner);
  return {
    id: owner.uuid,
    name: owner.name,
    model: modelPath,
    isDrawn: drawnModel !== null,
    failure: modelPath === null ? null : GameEntityModelLibrary.shared.failureRead(modelPath),
    size: drawnModel === null ? null : editorApiGameEntityModelSizeOf(drawnModel),
  };
}

/**
 * Measures the bounds of a drawn model in the space of the entity it belongs
 * to.
 *
 * @param drawnModel Drawn model, a child of the entity.
 * @returns Edge lengths along x, y and z.
 */
function editorApiGameEntityModelSizeOf(drawnModel: THREE.Object3D): [number, number, number] {
  const owner = drawnModel.parent ?? drawnModel;
  owner.updateWorldMatrix(true, true);
  const worldToOwner = owner.matrixWorld.clone().invert();
  const bounds = new THREE.Box3().setFromObject(drawnModel).applyMatrix4(worldToOwner);
  return bounds.getSize(new THREE.Vector3()).toArray();
}
