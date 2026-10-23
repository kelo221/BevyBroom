import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { CommandStackTransaction } from '@/commands/command_stack_transaction.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { CommandSolidModelCreate } from '@/solid/commands/model/command_solid_model_create.js';
import { CommandSolidShapeBrushesAdd } from '@/solid/commands/brushes/command_solid_shape_brushes_add.js';
import { CommandObjectGroup } from '@/outliner/commands/command_object_group.js';
import { markAsSolidCsgGroup } from '@/solid/model/solid_group.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { hierarchySeedBrushIdsCollectUnder } from '@/solid/model/hierarchy/solid_hierarchy_seed_collector.js';
import type { ShapeDrawShape } from './shapes/shape_draw_shape.js';
import type { ShapeDrawShapeParameterValues } from './shapes/shape_draw_shape_parameter.js';
import { shapeDrawPiecesBuildCreate } from './shape_draw_piece_build.js';
import { solidGroupShapeRecipeWrite } from '@/solid/model/solid_group_shape_recipe.js';

/** Name of the solid model created when a drawn brush has no model to join. */
export const SHAPE_DRAW_NEW_MODEL_NAME = 'World';

/** World mapping of the grid-local frame a shape was drawn in. */
export interface ShapeDrawFrameView {
  /**
   * Maps a grid-local position into world space.
   *
   * @param localPosition Grid-local position.
   * @returns New world position.
   */
  positionToWorld(localPosition: THREE.Vector3): THREE.Vector3;
  /**
   * Returns the world orientation of the grid-local axes.
   *
   * @returns New quaternion.
   */
  orientationWorld(): THREE.Quaternion;
}

/** Everything a drawn shape needs to become brushes. */
export interface ShapeDrawShapeCommitRequest {
  /** Shape to build. */
  shape: ShapeDrawShape;
  /** Parameter values keyed by parameter id. */
  parameters: ShapeDrawShapeParameterValues;
  /** Grid-local bounds the shape must fill. */
  boundsLocal: THREE.Box3;
  /** Frame view the local bounds live in. */
  gridFrame: ShapeDrawFrameView;
  /** Axis pointing up in the grid-local frame. */
  upAxis: 'x' | 'y' | 'z';
}

/** Editor systems a drawn shape is committed through. */
export interface ShapeDrawBrushCommitDeps {
  /** Undo history receiving one entry per drawn shape. */
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
   * Selects many meshes, used when the shape creates a group.
   *
   * @param meshes Meshes to select.
   * @returns True when the selection changed.
   */
  selectObjects?: (meshes: THREE.Mesh[]) => boolean;
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

/** Turns a drawn shape into brushes with one undo entry. */
export class ShapeDrawBrushCommit {
  private readonly deps: ShapeDrawBrushCommitDeps;

  /**
   * Creates the shape committer.
   *
   * @param deps Editor systems used for the commit.
   */
  constructor(deps: ShapeDrawBrushCommitDeps) {
    this.deps = deps;
  }

  /**
   * Creates the brushes of a drawn shape inside the active solid model
   * (creating a model when there is none), groups multi-piece shapes, selects
   * the result and records one undo entry.
   *
   * @param request Shape, parameters, grid-local bounds and grid frame.
   * @returns Mesh of the first new brush, or null when nothing was created.
   */
  shapeCommit(request: ShapeDrawShapeCommitRequest): THREE.Mesh | null {
    const worldPieces = this.worldPiecesCreate(request);
    if (worldPieces.length === 0) {
      return null;
    }
    const transaction = new CommandStackTransaction(this.deps.commandStack);
    const meshes = this.piecesCommit(request, worldPieces);
    if (meshes === null) {
      transaction.rollback();
      return null;
    }
    transaction.commit();
    this.deps.afterWorldMutation();
    return meshes[0] ?? null;
  }

  /**
   * Creates, groups and selects the brushes of the drawn pieces.
   *
   * @param request Shape, parameters and bounds.
   * @param worldPieces Convex point sets in world coordinates.
   * @returns Created meshes, or null when no piece closes into a brush.
   */
  private piecesCommit(request: ShapeDrawShapeCommitRequest, worldPieces: THREE.Vector3[][]): THREE.Mesh[] | null {
    const model = this.modelEnsure();
    const pieces = shapeDrawPiecesBuildCreate({ model, worldPieces });
    if (pieces.length === 0) {
      return null;
    }
    const meshes = this.brushesCreate(model, pieces);
    if (pieces.length > 1 && meshes.length > 1) {
      this.piecesGroup(model, meshes, request);
    }
    this.meshesSelect(meshes);
    return meshes;
  }

  /**
   * Pushes the add-brushes command and lists the created meshes.
   *
   * @param model Solid model receiving the brushes.
   * @param pieces Model-local brush pieces.
   * @returns Created meshes in piece order.
   */
  private brushesCreate(model: SolidModel, pieces: ReturnType<typeof shapeDrawPiecesBuildCreate>): THREE.Mesh[] {
    const command = new CommandSolidShapeBrushesAdd(
      model,
      pieces,
      this.deps.brushInsertParentResolve(model),
      this.deps.textureIdResolve(),
    );
    this.deps.commandStack.push(command);
    return this.createdMeshesCollect(command);
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
   * Builds the world point sets of a drawn shape.
   *
   * @param request Shape, parameters and grid-local bounds.
   * @returns Convex point sets in world coordinates.
   */
  private worldPiecesCreate(request: ShapeDrawShapeCommitRequest): THREE.Vector3[][] {
    return request.shape
      .piecesCreate({ bounds: request.boundsLocal, parameters: request.parameters, upAxis: request.upAxis })
      .map((points) => points.map((point) => request.gridFrame.positionToWorld(point)));
  }

  /**
   * Lists the preview meshes a shape command created.
   *
   * @param command Executed add-brushes command.
   * @returns Created meshes in piece order.
   */
  private createdMeshesCollect(command: CommandSolidShapeBrushesAdd): THREE.Mesh[] {
    return command
      .getCreatedBrushes()
      .map((brush) => brush.mesh)
      .filter((mesh): mesh is THREE.Mesh => mesh !== null);
  }

  /**
   * Groups the pieces of a multi-piece shape and stores its recipe.
   *
   * @param model Solid model receiving the shape.
   * @param meshes Created piece meshes.
   * @param request Shape, parameters and bounds.
   */
  private piecesGroup(model: SolidModel, meshes: THREE.Mesh[], request: ShapeDrawShapeCommitRequest): void {
    const parent = this.deps.brushInsertParentResolve(model);
    const command = new CommandObjectGroup(meshes, parent, request.shape.label);
    this.deps.commandStack.push(command);
    const group = command.getGroup();
    markAsSolidCsgGroup(group, SolidOperation.Additive);
    solidGroupShapeRecipeWrite(group, this.groupMetadataCreate(model, request));
    model.hierarchyMutationRefresh(hierarchySeedBrushIdsCollectUnder(model, group));
  }

  /**
   * Builds the regeneration recipe of a shape group in model space.
   *
   * @param model Solid model receiving the shape.
   * @param request Shape, parameters and bounds.
   * @returns Recipe stored on the group.
   */
  private groupMetadataCreate(model: SolidModel, request: ShapeDrawShapeCommitRequest) {
    model.root.updateWorldMatrix(true, false);
    const rootWorldQuaternion = model.root.getWorldQuaternion(new THREE.Quaternion());
    return {
      shapeId: request.shape.id,
      parameters: request.parameters,
      boundsMin: this.modelLocalCornerCreate(model, request, request.boundsLocal.min),
      boundsMax: this.modelLocalCornerCreate(model, request, request.boundsLocal.max),
      orientation: rootWorldQuaternion.clone().invert().multiply(request.gridFrame.orientationWorld()).toArray() as [
        number,
        number,
        number,
        number,
      ],
      upAxis: request.upAxis,
    };
  }

  /**
   * Maps one bounds corner from grid-local into model space.
   *
   * @param model Solid model receiving the shape.
   * @param request Grid-local bounds and grid frame.
   * @param cornerLocal Grid-local corner.
   * @returns Model-local corner components.
   */
  private modelLocalCornerCreate(
    model: SolidModel,
    request: ShapeDrawShapeCommitRequest,
    cornerLocal: THREE.Vector3,
  ): [number, number, number] {
    const world = request.gridFrame.positionToWorld(cornerLocal.clone());
    const modelLocal = model.root.worldToLocal(world);
    return [modelLocal.x, modelLocal.y, modelLocal.z];
  }

  /**
   * Selects the created meshes of a drawn shape.
   *
   * @param meshes Created piece meshes.
   */
  private meshesSelect(meshes: THREE.Mesh[]): void {
    if (meshes.length > 1 && this.deps.selectObjects) {
      this.deps.selectObjects(meshes);
      return;
    }
    const first = meshes[0];
    if (first) {
      this.deps.selectObject(first);
    }
  }
}
