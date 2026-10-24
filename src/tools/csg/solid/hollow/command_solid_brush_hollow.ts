import * as THREE from 'three';
import { UndoCommand } from '@/commands/command_undo.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { markAsSolidCsgGroup } from '@/solid/model/solid_group.js';
import { solidBrushModelPoseApply } from '@/solid/model/solid_brush_model_pose.js';
import { solidModelsFullRebuild } from '@/solid/commands/brushes/command_solid_brushes_geometry_edit.js';
import { hierarchyNameAllocator } from '@/utils/utils_hierarchy_name_allocator.js';
import type { HollowWallBuild } from '@/tools/csg/solid/hollow/hollow_walls_build.js';

/** Preview mesh size used when registering wall and restored brushes. */
const HOLLOW_WALL_PREVIEW_SIZE = 2;

/** One hollowed brush: the original plus its replacement walls. */
export interface CommandSolidBrushHollowEntry {
  /** Solid model owning the brush. */
  model: SolidModel;
  /** Brush instance id to hollow. */
  brushId: string;
  /** Built walls that replace the brush. */
  walls: readonly HollowWallBuild[];
  /** CSG operation copied onto every wall. */
  operation: SolidOperation;
}

interface EntryRuntime {
  entry: CommandSolidBrushHollowEntry;
  original: SolidBrushInstance;
  originalListIndex: number;
  originalParent: THREE.Object3D | null;
  originalSiblingIndex: number;
  group: THREE.Group;
  created: SolidBrushInstance[];
}

/**
 * Undoable command that replaces selected solid brushes with grouped hollow
 * wall brushes. One command instance covers every brush, so the whole hollow is
 * a single undo step.
 */
export class CommandSolidBrushHollow implements UndoCommand {
  private readonly entries: CommandSolidBrushHollowEntry[];
  private readonly runtimes: EntryRuntime[];
  private executed: boolean;

  /**
   * Creates a hollow command.
   *
   * @param entries Brushes to hollow with their prebuilt walls.
   */
  constructor(entries: readonly CommandSolidBrushHollowEntry[]) {
    this.entries = entries.slice();
    this.runtimes = [];
    this.executed = false;
  }

  /**
   * Returns the wall meshes created by the command.
   *
   * @returns Created meshes in wall order.
   */
  getCreatedMeshes(): THREE.Mesh[] {
    return this.runtimes.flatMap((runtime) =>
      runtime.created.map((instance) => instance.mesh).filter((mesh): mesh is THREE.Mesh => mesh !== null),
    );
  }

  /** Replaces every brush with its walls, or re-inserts them on redo. */
  execute(): void {
    if (this.executed) {
      return;
    }
    if (this.runtimes.length > 0) {
      this.runtimesReapply();
    } else {
      this.entriesApply();
    }
    this.executed = true;
  }

  /** Restores the original brushes and removes the walls. */
  undo(): void {
    if (!this.executed) {
      return;
    }
    for (const runtime of this.runtimes) {
      this.runtimeUndo(runtime);
    }
    this.modelsRebuild();
    this.executed = false;
  }

  /** Applies every entry for the first run. */
  private entriesApply(): void {
    for (const entry of this.entries) {
      this.entryApply(entry);
    }
    this.modelsRebuild();
  }

  /**
   * Hollows one brush entry.
   *
   * @param entry Brush and walls.
   */
  private entryApply(entry: CommandSolidBrushHollowEntry): void {
    const original = entry.model.findBrush(entry.brushId);
    if (!original || !original.mesh) {
      return;
    }
    const runtime = this.runtimeBuild(entry, original);
    this.runtimes.push(runtime);
    this.wallsInsert(runtime);
    this.originalRemove(runtime);
  }

  /**
   * Captures the undo state of one entry.
   *
   * @param entry Brush and walls.
   * @param original Brush instance being hollowed.
   * @returns Runtime state for undo and redo.
   */
  private runtimeBuild(entry: CommandSolidBrushHollowEntry, original: SolidBrushInstance): EntryRuntime {
    const parent = original.mesh ? original.mesh.parent : null;
    return {
      entry,
      original,
      originalListIndex: entry.model.getBrushes().indexOf(original),
      originalParent: parent,
      originalSiblingIndex: parent && original.mesh ? parent.children.indexOf(original.mesh) : 0,
      group: this.groupCreate(entry, original),
      created: [],
    };
  }

  /**
   * Creates the hollow group for one entry.
   *
   * @param entry Brush and walls.
   * @param original Brush instance being hollowed.
   * @returns Group placed where the original brush sat.
   */
  private groupCreate(entry: CommandSolidBrushHollowEntry, original: SolidBrushInstance): THREE.Group {
    const group = new THREE.Group();
    group.name = `${original.name} Hollow`;
    markAsSolidCsgGroup(group, entry.operation);
    const parent = original.mesh?.parent ?? entry.model.root;
    parent.add(group);
    return group;
  }

  /**
   * Creates and registers every wall of one entry.
   *
   * @param runtime Entry runtime.
   */
  private wallsInsert(runtime: EntryRuntime): void {
    for (const wall of runtime.entry.walls) {
      runtime.created.push(this.wallCreate(runtime, wall));
    }
    this.wallsRegister(runtime);
  }

  /**
   * Registers every created wall of one entry in the model, in wall order, at
   * the end of the brush list and under the hollow group.
   *
   * @param runtime Entry runtime holding the created walls.
   */
  private wallsRegister(runtime: EntryRuntime): void {
    const firstListIndex = runtime.entry.model.getBrushCount();
    runtime.created.forEach((instance, order) => {
      const hierarchy = { parent: runtime.group, siblingIndex: order };
      runtime.entry.model.insertBrushInstance(
        instance,
        firstListIndex + order,
        HOLLOW_WALL_PREVIEW_SIZE,
        hierarchy,
        false,
      );
    });
  }

  /**
   * Creates one wall brush instance.
   *
   * @param runtime Entry runtime.
   * @param wall Wall piece with surfaces.
   * @returns Instance with its mesh posed under the group.
   */
  private wallCreate(runtime: EntryRuntime, wall: HollowWallBuild): SolidBrushInstance {
    const model = runtime.entry.model;
    const instance = model.prepareTopologyBrush(wall.piece.topology, runtime.entry.operation, wall.piece.position);
    instance.name = hierarchyNameAllocator.allocate(`${runtime.original.name} Wall`);
    if (instance.mesh) {
      instance.mesh.name = instance.name;
    }
    solidBrushModelPoseApply(model, runtime.group, instance, wall.piece.position, wall.piece.rotation);
    wall.surfaces.forEach((surface, index) => instance.setFaceSurface(index, surface));
    return instance;
  }

  /**
   * Removes the original brush of one entry.
   *
   * @param runtime Entry runtime.
   */
  private originalRemove(runtime: EntryRuntime): void {
    runtime.entry.model.removeBrush(runtime.original.id, false, false);
  }

  /** Re-applies every runtime on redo. */
  private runtimesReapply(): void {
    for (const runtime of this.runtimes) {
      this.runtimeRedo(runtime);
    }
    this.modelsRebuild();
  }

  /**
   * Re-inserts walls and removes the original on redo.
   *
   * @param runtime Entry runtime.
   */
  private runtimeRedo(runtime: EntryRuntime): void {
    const parent = runtime.originalParent ?? runtime.entry.model.root;
    if (!runtime.group.parent) {
      parent.add(runtime.group);
    }
    runtime.created.forEach((instance) => instance.pushTransformToMesh());
    this.wallsRegister(runtime);
    this.originalRemove(runtime);
  }

  /**
   * Undoes one runtime.
   *
   * @param runtime Entry runtime.
   */
  private runtimeUndo(runtime: EntryRuntime): void {
    runtime.created.forEach((instance) => {
      runtime.entry.model.removeBrush(instance.id, false, false);
    });
    runtime.group.parent?.remove(runtime.group);
    runtime.original.pushTransformToMesh();
    const hierarchy = runtime.originalParent
      ? { parent: runtime.originalParent, siblingIndex: runtime.originalSiblingIndex }
      : undefined;
    runtime.entry.model.insertBrushInstance(
      runtime.original,
      runtime.originalListIndex,
      HOLLOW_WALL_PREVIEW_SIZE,
      hierarchy,
      false,
    );
  }

  /** Rebuilds every model the command touched once. */
  private modelsRebuild(): void {
    solidModelsFullRebuild(this.runtimes.map((runtime) => runtime.entry.model));
  }
}
