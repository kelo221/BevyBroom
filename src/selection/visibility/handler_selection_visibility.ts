import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import { selectableMeshesCollect } from '@/selection/object/selectable_mesh_filter.js';
import {
  CommandObjectsVisibilitySet,
  type ObjectVisibilityChange,
} from '@/outliner/commands/command_objects_visibility_set.js';

/** Editor parts the visibility commands act on. */
export interface HandlerSelectionVisibilityDeps {
  /** Undo stack receiving one entry per command. */
  commandStack: CommandStack;
  /** Object selection the commands read and clear. */
  selectionManager: ManagerSelection;
  /** Scene root holding the selectable objects. */
  worldObject: THREE.Object3D;
  /** Refreshes the outliner and the views after visibility changed. */
  afterVisibilityChange: () => void;
}

/**
 * Hides the selection, isolates it or shows every hidden object again, each as
 * one undo step.
 */
export class HandlerSelectionVisibility {
  /**
   * Creates the visibility commands.
   *
   * @param deps Undo stack, selection and scene root.
   */
  constructor(private readonly deps: HandlerSelectionVisibilityDeps) {}

  /**
   * Hides the selected objects and clears the selection.
   *
   * @returns Number of hidden objects.
   */
  hideSelected(): number {
    const selected = this.deps.selectionManager.getAllSelectedObjectsAsArray();
    const changed = this.visibilityCommit(
      selected.filter((mesh) => mesh.visible),
      false,
    );
    if (changed > 0) {
      this.deps.selectionManager.clearSelection();
    }
    return changed;
  }

  /**
   * Hides every visible selectable object that is not selected.
   *
   * @returns Number of hidden objects.
   */
  isolateSelected(): number {
    const selected = new Set(this.deps.selectionManager.getAllSelectedObjectsAsArray());
    if (selected.size === 0) {
      return 0;
    }
    const others = selectableMeshesCollect(this.deps.worldObject).filter(
      (mesh) => mesh.visible && !selected.has(mesh) && !this.ancestorSelectedIs(mesh, selected),
    );
    return this.visibilityCommit(others, false);
  }

  /**
   * Shows every hidden selectable object and its hidden parents.
   *
   * @returns Number of objects made visible.
   */
  showAll(): number {
    const hidden = new Set<THREE.Object3D>();
    for (const mesh of selectableMeshesCollect(this.deps.worldObject)) {
      this.hiddenChainCollect(mesh, hidden);
    }
    return this.visibilityCommit([...hidden], true);
  }

  /**
   * Adds an object and every hidden ancestor below the scene root to a set.
   *
   * @param object Selectable object.
   * @param hidden Hidden object accumulator.
   */
  private hiddenChainCollect(object: THREE.Object3D, hidden: Set<THREE.Object3D>): void {
    let current: THREE.Object3D | null = object;
    while (current && current !== this.deps.worldObject) {
      if (!current.visible) {
        hidden.add(current);
      }
      current = current.parent;
    }
  }

  /**
   * Returns whether a selected mesh contains this mesh.
   *
   * @param mesh Candidate mesh.
   * @param selected Selected meshes.
   * @returns True when an ancestor is selected.
   */
  private ancestorSelectedIs(mesh: THREE.Object3D, selected: ReadonlySet<THREE.Object3D>): boolean {
    let current = mesh.parent;
    while (current) {
      if (selected.has(current)) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Pushes one visibility command for the objects when there are any.
   *
   * @param objects Objects to change.
   * @param visible Visibility they receive.
   * @returns Number of changed objects.
   */
  private visibilityCommit(objects: readonly THREE.Object3D[], visible: boolean): number {
    if (objects.length === 0) {
      return 0;
    }
    const changes: ObjectVisibilityChange[] = objects.map((object) => ({ object, visible }));
    this.deps.commandStack.push(new CommandObjectsVisibilitySet(changes));
    this.deps.afterVisibilityChange();
    return changes.length;
  }
}
