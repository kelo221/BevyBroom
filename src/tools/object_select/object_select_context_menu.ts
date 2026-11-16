import type * as THREE from 'three';
import { GestureSecondaryClick } from '@/input/gesture/gesture_secondary_click.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import { MenuContext } from '@/ui/menu/menu_context.js';
import { menuEntriesAvailableFilter } from '@/ui/menu/menu_entries_available.js';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';

/** Editor parts the object right-click menu reads and drives. */
export interface ObjectSelectContextMenuDependencies {
  readonly selectionManager: Pick<ManagerSelection, 'getSelectedObjects' | 'selectObject'>;
  /**
   * Returns the meshes under a client point, nearest first.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @returns Picked meshes, empty when nothing is there.
   */
  readonly pickObjectStackAtClientPoint: (clientX: number, clientY: number) => THREE.Mesh[];
  /**
   * Builds the menu entries for the current selection.
   *
   * @returns Menu entries, including rows that do not apply now.
   */
  readonly entriesBuild: () => ToolbarMenuEntry[];
  /**
   * Returns whether an idle object tool owns the viewport clicks.
   *
   * @returns True when a right-click may open the menu.
   */
  readonly isContextMenuAllowed: () => boolean;
}

/**
 * Opens a menu of the commands that apply to the selection when the right mouse
 * button is clicked in a map view without dragging; a right drag keeps flying
 * or panning the view. A click on an unselected object selects it first; a
 * click on a selected object or on empty space keeps the selection. Rows that
 * do not apply are hidden.
 */
export class ObjectSelectContextMenu {
  private readonly dependencies: ObjectSelectContextMenuDependencies;
  private readonly secondaryClickGesture = new GestureSecondaryClick();
  private openMenu: MenuContext | null = null;

  /**
   * Creates the right-click menu handler.
   *
   * @param dependencies Selection, picking and menu entries it uses.
   */
  constructor(dependencies: ObjectSelectContextMenuDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * Arms the menu at a right-button press; the release opens it when the
   * pointer did not travel.
   *
   * @param ownerWindow Window that owns the press.
   * @param clientX Press client X.
   * @param clientY Press client Y.
   */
  pressBegin(ownerWindow: Window, clientX: number, clientY: number): void {
    if (!this.dependencies.isContextMenuAllowed()) {
      return;
    }
    this.secondaryClickGesture.begin(ownerWindow, clientX, clientY, () => this.open(clientX, clientY));
  }

  /**
   * Selects the object under a client point when it is not selected yet and
   * opens the menu there.
   *
   * @param clientX Client X of the click.
   * @param clientY Client Y of the click.
   * @returns True when a menu opened.
   */
  open(clientX: number, clientY: number): boolean {
    this.close();
    this.hitObjectSelect(clientX, clientY);
    const entries = menuEntriesAvailableFilter(this.dependencies.entriesBuild());
    if (entries.length === 0) {
      return false;
    }
    this.openMenu = MenuContext.fromEntries(entries);
    this.openMenu.show(clientX, clientY);
    return true;
  }

  /** Closes an open menu. */
  close(): void {
    this.openMenu?.dispose();
    this.openMenu = null;
  }

  /** Disarms a pending press and closes an open menu. */
  dispose(): void {
    this.secondaryClickGesture.cancel();
    this.close();
  }

  /**
   * Makes the nearest object under a point the selection unless an object under
   * the point is already selected.
   *
   * @param clientX Client X of the click.
   * @param clientY Client Y of the click.
   */
  private hitObjectSelect(clientX: number, clientY: number): void {
    const pickedMeshes = this.dependencies.pickObjectStackAtClientPoint(clientX, clientY);
    const selectedMeshes = this.dependencies.selectionManager.getSelectedObjects();
    const nearestMesh = pickedMeshes[0];
    if (nearestMesh && !pickedMeshes.some((mesh) => selectedMeshes.has(mesh))) {
      this.dependencies.selectionManager.selectObject(nearestMesh);
    }
  }
}
