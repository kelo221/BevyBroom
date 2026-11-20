import * as THREE from 'three';
import type { UndoCommand } from '@/commands/command_undo.js';
import { CommandUndoBatch } from '@/commands/command_undo_batch.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { CollisionKindStore } from '@/level_export/kind/collision_kind_store.js';
import { SolidModelCodec } from '@/solid/io/solid_model_codec.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidBrushVisual } from '@/solid/model/solid_brush_visual.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { CommandSolidBrushesDelete } from '@/solid/commands/brushes/command_solid_brushes_delete.js';
import { CommandSolidModelCreate } from '@/solid/commands/model/command_solid_model_create.js';

/**
 * Undoable move of every brush that carries game components out of its solid
 * model into a new solid model of its own, which takes over the components. The
 * new model keeps the brush's uuid and name, so repeated runs produce the same
 * objects. Undo puts the brushes back and removes the new models.
 */
export class CommandSolidBrushGameComponentsDetach extends CommandUndoBatch {
  private readonly createdModels: readonly SolidModel[];

  /**
   * Creates the command from its prepared steps.
   *
   * @param steps Brush removal and model creation steps in execution order.
   * @param createdModels Solid models the command adds.
   */
  private constructor(steps: readonly UndoCommand[], createdModels: readonly SolidModel[]) {
    super(steps);
    this.createdModels = createdModels;
  }

  /**
   * Builds the command for every brush under a world that carries game
   * components.
   *
   * @param worldGroup World root that receives the new solid models.
   * @returns Command, or null when no brush carries components.
   */
  static createForWorld(worldGroup: THREE.Object3D): CommandSolidBrushGameComponentsDetach | null {
    const brushMeshes = CommandSolidBrushGameComponentsDetach.brushesWithComponentsCollect(worldGroup);
    if (brushMeshes.length === 0) {
      return null;
    }
    const createdModels = brushMeshes.map((brushMesh) =>
      CommandSolidBrushGameComponentsDetach.modelOfBrushCreate(brushMesh, worldGroup),
    );
    const modelCreates = createdModels.map((model) => new CommandSolidModelCreate(model, worldGroup));
    return new CommandSolidBrushGameComponentsDetach(
      [new CommandSolidBrushesDelete(brushMeshes), ...modelCreates],
      createdModels,
    );
  }

  /**
   * Returns the solid models the command adds.
   *
   * @returns New solid models.
   */
  createdModelsRead(): readonly SolidModel[] {
    return this.createdModels;
  }

  /**
   * Frees the geometry of the new solid models. Call it only once the models
   * are out of the scene for good, after an undo.
   */
  createdModelsRelease(): void {
    for (const model of this.createdModels) {
      model.root.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
        }
      });
    }
  }

  /**
   * Returns whether an object is a solid brush that carries game components.
   *
   * @param object Scene object.
   * @returns True for a brush mesh with components inside a solid model.
   */
  static brushWithComponentsIs(object: THREE.Object3D): object is THREE.Mesh {
    return (
      object instanceof THREE.Mesh &&
      SolidBrushVisual.isBrushObject(object) &&
      SolidModel.fromObject(object) !== null &&
      GameEntityComponentStore.hasAny(object)
    );
  }

  /**
   * Collects the brushes under a world that carry game components.
   *
   * @param worldGroup World root.
   * @returns Brush meshes.
   */
  private static brushesWithComponentsCollect(worldGroup: THREE.Object3D): THREE.Mesh[] {
    const brushMeshes: THREE.Mesh[] = [];
    worldGroup.traverse((object) => {
      if (CommandSolidBrushGameComponentsDetach.brushWithComponentsIs(object)) {
        brushMeshes.push(object);
      }
    });
    return brushMeshes;
  }

  /**
   * Builds the new solid model of one brush: an additive copy of the brush in
   * place, with the brush's uuid, name, game components and collision kind.
   *
   * @param brushMesh Brush mesh with components.
   * @param worldGroup World root the model is placed in.
   * @returns Solid model not yet parented.
   */
  private static modelOfBrushCreate(brushMesh: THREE.Mesh, worldGroup: THREE.Object3D): SolidModel {
    const model = new SolidModel(brushMesh.name);
    model.root.uuid = brushMesh.uuid;
    CommandSolidBrushGameComponentsDetach.brushCopyDecode(brushMesh, model, worldGroup);
    GameEntityComponentStore.write(model.root, GameEntityComponentStore.read(brushMesh));
    CollisionKindStore.overrideWrite(model.root, CollisionKindStore.overrideRead(brushMesh));
    return model;
  }

  /**
   * Decodes an additive copy of a brush into a model whose root sits at the
   * world origin, keeping the brush where it is in the world.
   *
   * @param brushMesh Brush mesh to copy.
   * @param model Model receiving the copy.
   * @param worldGroup World root the model is placed in.
   */
  private static brushCopyDecode(brushMesh: THREE.Mesh, model: SolidModel, worldGroup: THREE.Object3D): void {
    const sourceModel = SolidModel.fromObject(brushMesh);
    if (!sourceModel) {
      return;
    }
    const payload = SolidModelCodec.encodeNodesWorldSpace(sourceModel, [brushMesh]);
    payload.brushes.forEach((brush) => (brush.operation = SolidOperation.Additive));
    worldGroup.add(model.root);
    SolidModelCodec.decodeNodesInto(model, payload);
    worldGroup.remove(model.root);
  }
}
