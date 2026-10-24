import * as THREE from 'three';
import { UndoCommand } from '@/commands/command_undo.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import type { SolidShapeBrushPiece } from '@/solid/commands/brushes/command_solid_shape_brushes_add.js';
import { solidBrushModelPoseApply } from '@/solid/model/solid_brush_model_pose.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import type { SolidGroupShapeRecipe } from '@/solid/model/solid_group_shape_recipe.js';
import { solidGroupShapeRecipeRead, solidGroupShapeRecipeWrite } from '@/solid/model/solid_group_shape_recipe.js';

/**
 * Undoable command that swaps the brushes of a shape draw group for freshly
 * generated pieces while keeping the group and its place in the hierarchy.
 */
export class CommandShapeDrawGroupRebuild implements UndoCommand {
  private readonly model: SolidModel;
  private readonly group: THREE.Group;
  private readonly previousBrushes: SolidBrushInstance[];
  private readonly nextPieces: SolidShapeBrushPiece[];
  private readonly textureId: string | null;
  private readonly nextMetadata: SolidGroupShapeRecipe;
  private readonly previousMetadata: SolidGroupShapeRecipe | null;
  private readonly previousListIndexes: number[] = [];
  private readonly previousSiblingIndexes: number[] = [];
  private createdBrushes: SolidBrushInstance[] = [];
  private executed = false;

  /**
   * Creates a group rebuild command.
   *
   * @param model Solid model owning the group.
   * @param group Shape draw group whose brushes are replaced.
   * @param previousBrushes Brushes currently under the group.
   * @param nextPieces Replacement pieces posed in model space.
   * @param textureId Texture carried over to every new brush face.
   * @param nextMetadata Updated recipe stored on the group.
   */
  constructor(
    model: SolidModel,
    group: THREE.Group,
    previousBrushes: SolidBrushInstance[],
    nextPieces: SolidShapeBrushPiece[],
    textureId: string | null,
    nextMetadata: SolidGroupShapeRecipe,
  ) {
    this.model = model;
    this.group = group;
    this.previousBrushes = previousBrushes.slice();
    this.nextPieces = nextPieces;
    this.textureId = textureId;
    this.nextMetadata = nextMetadata;
    this.previousMetadata = solidGroupShapeRecipeRead(group);
    this.previousBrushes.forEach((brush) => {
      this.previousListIndexes.push(model.getBrushes().findIndex((entry) => entry.id === brush.id));
      this.previousSiblingIndexes.push(group.children.indexOf(brush.mesh ?? group));
    });
  }

  /** Replaces the group brushes on first run, or re-replaces them on redo. */
  execute(): void {
    if (this.executed) {
      return;
    }
    this.previousBrushesRemove();
    this.nextBrushesInsert();
    solidGroupShapeRecipeWrite(this.group, this.nextMetadata);
    this.executed = true;
  }

  /** Restores the previous brushes and recipe. */
  undo(): void {
    if (!this.executed) {
      return;
    }
    this.createdBrushes.forEach((brush) => this.model.removeBrush(brush.id, false, false));
    this.previousBrushesReinsert();
    this.previousMetadataRestore();
    this.executed = false;
  }

  /** Writes the recipe the group had before the rebuild back onto it. */
  private previousMetadataRestore(): void {
    if (this.previousMetadata) {
      solidGroupShapeRecipeWrite(this.group, this.previousMetadata);
    }
  }

  /**
   * Returns the brushes created by the rebuild.
   *
   * @returns Created brushes in piece order.
   */
  getCreatedBrushes(): SolidBrushInstance[] {
    return this.createdBrushes.slice();
  }

  /** Removes the replaced brushes from the model. */
  private previousBrushesRemove(): void {
    for (const brush of this.previousBrushes) {
      this.model.removeBrush(brush.id, false, false);
    }
  }

  /** Creates, poses and registers the replacement brushes under the group. */
  private nextBrushesInsert(): void {
    const instances: SolidBrushInstance[] = [];
    for (const piece of this.nextPieces) {
      instances.push(this.nextBrushCreate(piece));
    }
    this.instancesRegister(instances);
    this.createdBrushes = instances;
  }

  /**
   * Creates one posed replacement brush.
   *
   * @param piece Replacement piece in model space.
   * @returns Instance not yet registered on the model.
   */
  private nextBrushCreate(piece: SolidShapeBrushPiece): SolidBrushInstance {
    const instance = this.model.prepareTopologyBrush(
      piece.topology,
      SolidOperation.Additive,
      piece.position,
      this.textureId ?? undefined,
    );
    solidBrushModelPoseApply(this.model, this.group, instance, piece.position, piece.rotation);
    return instance;
  }

  /**
   * Inserts the replacement brushes under the group with one rebuild.
   *
   * @param instances Replacement brushes.
   */
  private instancesRegister(instances: SolidBrushInstance[]): void {
    let listIndex = this.replacementListIndexResolve();
    instances.forEach((instance, order) => {
      this.model.insertBrushInstance(instance, listIndex, 2, { parent: this.group, siblingIndex: order }, false);
      listIndex += 1;
    });
    this.model.markDirty();
    this.model.rebuild(true);
  }

  /**
   * Returns the evaluation list index the replacement brushes start at.
   *
   * @returns List index of the first replaced brush, or the end of the list.
   */
  private replacementListIndexResolve(): number {
    const firstKnownIndex = this.previousListIndexes.find((index) => index >= 0);
    return firstKnownIndex ?? this.model.getBrushCount();
  }

  /** Re-inserts the previous brushes at their recorded positions. */
  private previousBrushesReinsert(): void {
    this.previousBrushes.forEach((brush, order) => {
      brush.pushTransformToMesh();
      this.model.insertBrushInstance(
        brush,
        Math.max(0, this.previousListIndexes[order] ?? this.model.getBrushCount()),
        2,
        { parent: this.group, siblingIndex: this.previousSiblingIndexes[order] ?? order },
        false,
      );
    });
    this.model.markDirty();
    this.model.rebuild(true);
  }
}
