import * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import { CommandStackTransaction } from '@/commands/command_stack_transaction.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { CommandSolidModelCreate } from '@/solid/commands/model/command_solid_model_create.js';
import { CommandSolidBoxBrushAdd } from '@/solid/commands/brush/command_solid_box_brush_add.js';
import type { ShapeDrawWorldBox } from './shape_draw_world_box.js';

/** Name of the solid model created when a drawn brush has no model to join. */
export const SHAPE_DRAW_NEW_MODEL_NAME = 'World';

/** Editor systems a drawn brush is committed through. */
export interface ShapeDrawBrushCommitDeps {
  /** Undo history receiving one entry per drawn brush. */
  commandStack: CommandStack;
  /** World root new solid models are parented under. */
  worldObject: THREE.Object3D;
  /**
   * Selects one mesh.
   *
   * @param mesh Mesh to select.
   * @returns True when the selection changed.
   */
  selectObject: (mesh: THREE.Mesh) => boolean;
  /**
   * Returns the solid model new brushes join.
   *
   * @returns Active solid model, or null when there is none.
   */
  activeModelResolve: () => SolidModel | null;
  /**
   * Returns the parent new brushes are inserted under.
   *
   * @param model Solid model receiving the brush.
   * @returns Solid root or CSG group.
   */
  brushInsertParentResolve: (model: SolidModel) => THREE.Object3D;
  /**
   * Returns the texture applied to new brushes.
   *
   * @returns Texture id, or null to keep the default surface.
   */
  textureIdResolve: () => string | null;
  /** Refreshes viewports and panels after the world changed. */
  afterWorldMutation: () => void;
}

/** Turns a drawn world box into an additive box brush with one undo entry. */
export class ShapeDrawBrushCommit {
  private readonly deps: ShapeDrawBrushCommitDeps;

  /**
   * Creates the brush committer.
   *
   * @param deps Editor systems used for the commit.
   */
  constructor(deps: ShapeDrawBrushCommitDeps) {
    this.deps = deps;
  }

  /**
   * Creates an additive box brush filling a world box inside the active solid
   * model (creating a model when there is none) and selects it.
   *
   * @param worldBox World box the brush must fill exactly.
   * @returns Mesh of the new brush, or null when no brush was created.
   */
  brushCommit(worldBox: ShapeDrawWorldBox): THREE.Mesh | null {
    const transaction = new CommandStackTransaction(this.deps.commandStack);
    const model = this.modelEnsure();
    const command = this.brushAddCommandCreate(model, worldBox);
    this.deps.commandStack.push(command);
    transaction.commit();
    const mesh = command.getCreatedBrush()?.mesh ?? null;
    if (mesh) {
      this.deps.selectObject(mesh);
    }
    this.deps.afterWorldMutation();
    return mesh;
  }

  /**
   * Returns the active solid model, pushing the creation of a new one when
   * there is none.
   *
   * @returns Solid model parented in the world.
   */
  private modelEnsure(): SolidModel {
    const activeModel = this.deps.activeModelResolve();
    if (activeModel) {
      return activeModel;
    }
    const createdModel = new SolidModel(SHAPE_DRAW_NEW_MODEL_NAME);
    this.deps.commandStack.push(new CommandSolidModelCreate(createdModel, this.deps.worldObject));
    return createdModel;
  }

  /**
   * Builds the add-brush command with the box pose expressed in model space.
   *
   * @param model Solid model receiving the brush.
   * @param worldBox World box to fill.
   * @returns Unexecuted add-brush command.
   */
  private brushAddCommandCreate(model: SolidModel, worldBox: ShapeDrawWorldBox): CommandSolidBoxBrushAdd {
    model.root.updateWorldMatrix(true, false);
    const rootWorldPosition = new THREE.Vector3();
    const rootWorldQuaternion = new THREE.Quaternion();
    const rootWorldScale = new THREE.Vector3();
    model.root.matrixWorld.decompose(rootWorldPosition, rootWorldQuaternion, rootWorldScale);
    const modelLocalCenter = model.root.worldToLocal(worldBox.center.clone());
    const modelLocalQuaternion = rootWorldQuaternion.invert().multiply(worldBox.orientation);
    const modelLocalSize = worldBox.size.clone().divide(rootWorldScale);
    const parent = this.deps.brushInsertParentResolve(model);
    const rotation = new THREE.Euler().setFromQuaternion(modelLocalQuaternion);
    const textureId = this.deps.textureIdResolve();
    return new CommandSolidBoxBrushAdd(
      model,
      modelLocalSize,
      SolidOperation.Additive,
      modelLocalCenter,
      parent,
      rotation,
      textureId,
    );
  }
}
