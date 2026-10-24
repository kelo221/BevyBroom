import * as THREE from 'three';
import { UndoCommand } from '@/commands/command_undo.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import type { SolidBrush } from '@/solid/brush/solid_brush.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { solidBrushModelPoseApply } from '@/solid/model/solid_brush_model_pose.js';

/** One convex brush piece with its model-local pose. */
export interface SolidShapeBrushPiece {
  /** Convex topology centered on its own origin. */
  topology: SolidBrush;
  /** Model-local piece center. */
  position: THREE.Vector3;
  /** Model-local piece rotation. */
  rotation: THREE.Euler;
}

/**
 * Undoable command that adds several posed convex brushes to a solid model in
 * one history entry.
 */
export class CommandSolidShapeBrushesAdd implements UndoCommand {
  private readonly model: SolidModel;
  private readonly pieces: SolidShapeBrushPiece[];
  private readonly textureId: string | null;
  private readonly hierarchyParent: THREE.Object3D;
  private readonly created: SolidBrushInstance[] = [];
  private readonly listIndexes: number[] = [];
  private executed = false;

  /**
   * Creates a multi-brush add command.
   *
   * @param model Solid model that will own the brushes.
   * @param pieces Convex pieces with model-local poses.
   * @param hierarchyParent Solid root or CSG group to append under.
   * @param textureId Texture applied to every face, or null to keep the default
   *   surface.
   */
  constructor(
    model: SolidModel,
    pieces: SolidShapeBrushPiece[],
    hierarchyParent: THREE.Object3D,
    textureId: string | null,
  ) {
    this.model = model;
    this.pieces = pieces;
    this.hierarchyParent = model.resolveBrushInsertParent(hierarchyParent);
    this.textureId = textureId;
  }

  /**
   * Returns the brushes created by this command.
   *
   * @returns Created brushes in piece order (empty before the first run).
   */
  getCreatedBrushes(): SolidBrushInstance[] {
    return this.created.slice();
  }

  /** Creates every brush on first run, or re-inserts them on redo. */
  execute(): void {
    if (this.executed) {
      return;
    }
    if (this.created.length > 0) {
      this.reinsertCreatedBrushes();
    } else {
      this.createBrushes();
    }
    this.executed = true;
  }

  /** Removes every created brush without disposing preview resources. */
  undo(): void {
    if (!this.executed) {
      return;
    }
    for (const brush of this.created) {
      this.model.removeBrush(brush.id, false, false);
    }
    this.model.markDirty();
    this.model.rebuild(true);
    this.executed = false;
  }

  /** Builds, poses and inserts every piece with one CSG rebuild. */
  private createBrushes(): void {
    const instances: SolidBrushInstance[] = [];
    for (const piece of this.pieces) {
      instances.push(this.pieceCreate(piece));
    }
    this.instancesInsert(instances);
    this.created.push(...instances);
  }

  /**
   * Creates one posed brush instance from a piece.
   *
   * @param piece Convex piece with model-local pose.
   * @returns Instance not yet registered on the model.
   */
  private pieceCreate(piece: SolidShapeBrushPiece): SolidBrushInstance {
    const instance = this.model.prepareTopologyBrush(
      piece.topology,
      SolidOperation.Additive,
      piece.position,
      this.textureId ?? undefined,
    );
    solidBrushModelPoseApply(this.model, this.hierarchyParent, instance, piece.position, piece.rotation);
    return instance;
  }

  /** Re-inserts previously created brushes at their recorded indexes. */
  private reinsertCreatedBrushes(): void {
    const instances = this.created.filter((brush) => !this.model.findBrush(brush.id));
    instances.forEach((instance) => instance.pushTransformToMesh());
    for (const instance of instances) {
      const order = this.created.indexOf(instance);
      this.model.insertBrushInstance(
        instance,
        this.listIndexes[order] ?? this.model.getBrushCount(),
        2,
        this.hierarchyPlacementCreate(order),
        false,
      );
    }
    this.model.markDirty();
    this.model.rebuild(true);
  }

  /**
   * Builds one insert placement under a nested parent, or undefined for the
   * solid root.
   *
   * @param order Creation order of the brush.
   * @returns Hierarchy placement or undefined.
   */
  private hierarchyPlacementCreate(order: number): { parent: THREE.Object3D; siblingIndex: number } | undefined {
    if (this.hierarchyParent === this.model.root) {
      return undefined;
    }
    return { parent: this.hierarchyParent, siblingIndex: this.hierarchyParent.children.length + order };
  }

  /**
   * Registers instances under the hierarchy parent with one CSG rebuild.
   *
   * @param instances Brushes to insert.
   */
  private instancesInsert(instances: SolidBrushInstance[]): void {
    let listIndex = this.model.getBrushCount();
    instances.forEach((instance, order) => {
      this.model.insertBrushInstance(instance, listIndex, 2, this.hierarchyPlacementCreate(order), false);
      this.listIndexes.push(listIndex);
      listIndex += 1;
    });
    this.model.markDirty();
    this.model.rebuild(true);
  }
}
