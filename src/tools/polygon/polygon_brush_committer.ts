import * as THREE from 'three';
import { CommandStackTransaction } from '@/commands/command_stack_transaction.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { CommandSolidModelCreate } from '@/solid/commands/model/command_solid_model_create.js';
import { CommandSolidShapeBrushesAdd } from '@/solid/commands/brushes/command_solid_shape_brushes_add.js';
import { CommandSolidBrushesDelete } from '@/solid/commands/brushes/command_solid_brushes_delete.js';
import { CommandObjectGroup } from '@/outliner/commands/command_object_group.js';
import { markAsSolidCsgGroup } from '@/solid/model/solid_group.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { hierarchySeedBrushIdsCollectUnder } from '@/solid/model/hierarchy/solid_hierarchy_seed_collector.js';
import { shapeDrawPiecesBuildCreate } from '@/tools/shape_draw/shape_draw_piece_build.js';
import { ShapeDrawSurfaceAnchor } from '@/tools/shape_draw/surface/shape_draw_surface_anchor.js';
import {
  SHAPE_DRAW_NEW_MODEL_NAME,
  type ShapeDrawBrushCommitDeps,
} from '@/tools/shape_draw/shape_draw_brush_commit.js';
import { selectionMeshesFromHierarchyCollect } from '@/selection/object/selection_hierarchy_meshes.js';
import { PolygonConvexDecomposer } from './polygon_convex_decomposer.js';
import {
  polygonOutlineRecipeToFrame,
  polygonOutlineRecipeWrite,
  type PolygonOutlineRecipe,
} from './polygon_outline_recipe.js';

/**
 * Commits 2D polygon outline extrusions as convex CSG brushes (grouped when
 * concave) and stores the re-editable `PolygonOutlineRecipe` on the result.
 */
export class PolygonBrushCommitter {
  private readonly deps: ShapeDrawBrushCommitDeps;

  /**
   * Creates a polygon brush committer.
   *
   * @param deps Editor systems used to commit brushes.
   */
  constructor(deps: ShapeDrawBrushCommitDeps) {
    this.deps = deps;
  }

  /**
   * Extrudes a 2D polygon recipe into convex CSG brushes in one undo entry.
   *
   * @param recipe Polygon outline recipe to extrude.
   * @returns Created brush meshes, or empty array when invalid.
   */
  commitRecipe(recipe: PolygonOutlineRecipe): THREE.Mesh[] {
    const { outline, frame } = polygonOutlineRecipeToFrame(recipe);
    const worldPieces = PolygonConvexDecomposer.extrudeToWorldPieces(outline, frame);
    if (worldPieces.length === 0) {
      return [];
    }
    const transaction = new CommandStackTransaction(this.deps.commandStack);
    const meshes = this.piecesCommit(recipe, worldPieces, null);
    if (meshes.length === 0) {
      transaction.rollback();
      return [];
    }
    transaction.commit();
    this.deps.afterWorldMutation();
    return meshes;
  }

  /**
   * Rebuilds an existing Polygon brush or CSG group from an edited outline
   * recipe inside a single undo transaction.
   *
   * @param target Existing brush mesh or CSG group holding a polygon recipe.
   * @param recipe Updated polygon outline recipe.
   * @returns Newly created brush meshes.
   */
  regenerateTarget(target: THREE.Object3D, recipe: PolygonOutlineRecipe): THREE.Mesh[] {
    const { outline, frame } = polygonOutlineRecipeToFrame(recipe);
    const worldPieces = PolygonConvexDecomposer.extrudeToWorldPieces(outline, frame);
    const model = this.deps.activeModelResolve();
    if (worldPieces.length === 0 || !model) {
      return [];
    }
    const insertParent = target instanceof THREE.Group ? target : (target.parent ?? model.root);
    return this.executeRegenerateTransaction(target, recipe, worldPieces, insertParent);
  }

  /**
   * Runs the delete + re-insert undo transaction for `regenerateTarget`.
   *
   * @param target Target brush or CSG group.
   * @param recipe Updated polygon outline recipe.
   * @param worldPieces Convex 3D point sets.
   * @param insertParent Parent object for recreated brushes.
   * @returns Newly created brush meshes.
   */
  private executeRegenerateTransaction(
    target: THREE.Object3D,
    recipe: PolygonOutlineRecipe,
    worldPieces: THREE.Vector3[][],
    insertParent: THREE.Object3D,
  ): THREE.Mesh[] {
    const oldMeshes = selectionMeshesFromHierarchyCollect([target]);
    const transaction = new CommandStackTransaction(this.deps.commandStack);
    if (oldMeshes.length > 0) {
      this.deps.commandStack.push(new CommandSolidBrushesDelete(oldMeshes));
    }
    const meshes = this.piecesCommit(recipe, worldPieces, insertParent);
    if (meshes.length === 0) {
      transaction.rollback();
      return [];
    }
    polygonOutlineRecipeWrite(target, recipe);
    transaction.commit();
    this.deps.afterWorldMutation();
    return meshes;
  }

  /**
   * Builds and inserts the convex brush pieces for a polygon extrusion.
   *
   * @param recipe Polygon outline recipe to store.
   * @param worldPieces Convex 3D point sets.
   * @param explicitParent Optional parent to insert brushes under.
   * @returns Created brush meshes.
   */
  private piecesCommit(
    recipe: PolygonOutlineRecipe,
    worldPieces: THREE.Vector3[][],
    explicitParent: THREE.Object3D | null,
  ): THREE.Mesh[] {
    const model = this.modelEnsure();
    const pieces = shapeDrawPiecesBuildCreate({ model, worldPieces });
    if (pieces.length === 0) {
      return [];
    }
    const parent = explicitParent ?? this.deps.brushInsertParentResolve(model);
    const meshes = this.brushesCreate(model, pieces, parent);
    this.attachRecipeOrGroup(model, meshes, parent, explicitParent !== null, recipe);
    this.meshesSelect(meshes);
    return meshes;
  }

  /**
   * Attaches the recipe directly or groups multiple convex pieces into a CSG
   * group.
   *
   * @param model Solid model receiving the brushes.
   * @param meshes Created piece meshes.
   * @param parent Parent object.
   * @param inExistingContainer True when regenerating inside an existing group.
   * @param recipe Polygon outline recipe.
   */
  private attachRecipeOrGroup(
    model: SolidModel,
    meshes: THREE.Mesh[],
    parent: THREE.Object3D,
    inExistingContainer: boolean,
    recipe: PolygonOutlineRecipe,
  ): void {
    if (!inExistingContainer && meshes.length > 1) {
      const groupCommand = new CommandObjectGroup(meshes, parent, 'Polygon');
      this.deps.commandStack.push(groupCommand);
      const group = groupCommand.getGroup();
      markAsSolidCsgGroup(group, SolidOperation.Additive);
      polygonOutlineRecipeWrite(group, recipe);
      model.hierarchyMutationRefresh(hierarchySeedBrushIdsCollectUnder(model, group));
      return;
    }
    if (meshes[0]) {
      polygonOutlineRecipeWrite(meshes[0], recipe);
    }
  }

  /**
   * Executes `CommandSolidShapeBrushesAdd` for the decomposed convex pieces.
   *
   * @param model Solid model receiving the brushes.
   * @param pieces Model-local convex pieces.
   * @param parent Parent node for the new brushes.
   * @returns Created brush meshes.
   */
  private brushesCreate(
    model: SolidModel,
    pieces: ReturnType<typeof shapeDrawPiecesBuildCreate>,
    parent: THREE.Object3D,
  ): THREE.Mesh[] {
    const command = new CommandSolidShapeBrushesAdd(
      model,
      pieces,
      parent,
      this.deps.textureIdResolve(),
      pieces.length > 1 ? ShapeDrawSurfaceAnchor.surfacesAnchor : null,
    );
    this.deps.commandStack.push(command);
    return command
      .getCreatedBrushes()
      .map((brush) => brush.mesh)
      .filter((mesh): mesh is THREE.Mesh => mesh !== null);
  }

  /**
   * Returns the active solid model or creates one when none exists.
   *
   * @returns Active solid model.
   */
  private modelEnsure(): SolidModel {
    const active = this.deps.activeModelResolve();
    if (active) {
      return active;
    }
    const created = new SolidModel(SHAPE_DRAW_NEW_MODEL_NAME);
    this.deps.commandStack.push(new CommandSolidModelCreate(created, this.deps.worldObject));
    return created;
  }

  /**
   * Selects the newly created polygon brush meshes.
   *
   * @param meshes Created brush meshes.
   */
  private meshesSelect(meshes: THREE.Mesh[]): void {
    if (meshes.length > 1 && this.deps.selectObjects) {
      this.deps.selectObjects(meshes);
      return;
    }
    if (meshes[0]) {
      this.deps.selectObject(meshes[0]);
    }
  }
}
