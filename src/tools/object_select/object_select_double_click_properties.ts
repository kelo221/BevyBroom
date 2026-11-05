import type * as THREE from 'three';
import { PointerDoubleClickDetector } from '@/input/pointer_double_click_detector.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';

/** Editor parts the object double-click reads and drives. */
export interface ObjectSelectDoubleClickPropertiesDependencies {
  readonly selectionManager: ManagerSelection;
  /**
   * Returns the meshes under a client point, nearest first.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @returns Picked meshes, empty when nothing is there.
   */
  readonly pickObjectStackAtClientPoint: (clientX: number, clientY: number) => THREE.Mesh[];
  /** Opens the Object Properties dialog on the current selection. */
  readonly objectPropertiesOpen: () => void;
  /**
   * Returns whether an idle object tool owns the viewport clicks, outside edit
   * mode and placement tools.
   *
   * @returns True when double-clicks may open Object Properties.
   */
  readonly isDoubleClickAllowed: () => boolean;
}

/** Object selection as it was before the first click of a double-click. */
interface ObjectSelectDoubleClickSelectionSnapshot {
  readonly meshes: readonly THREE.Mesh[];
  readonly inspectorObjects: readonly THREE.Object3D[];
}

/**
 * Opens Object Properties when a double-click lands on an object while the
 * object tool is idle. Two plain click releases of the tool form the
 * double-click; the browser's own double-click event covers the presses the
 * tool never sees as clicks, such as presses on gizmo handles. The object under
 * the pointer ends up selected; a multi-selection that contained it before the
 * first click is kept whole.
 */
export class ObjectSelectDoubleClickProperties {
  private readonly dependencies: ObjectSelectDoubleClickPropertiesDependencies;
  private readonly pointerDoubleClickDetector = new PointerDoubleClickDetector();
  private readonly clickReleasePairOpenDetector = new PointerDoubleClickDetector();
  private selectionBeforeFirstClick: ObjectSelectDoubleClickSelectionSnapshot | null = null;

  /**
   * Creates the double-click handler.
   *
   * @param dependencies Selection, picking and dialog opening it uses.
   */
  constructor(dependencies: ObjectSelectDoubleClickPropertiesDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * Handles an object tool click release before its click selection runs.
   *
   * @param clientX Release client X.
   * @param clientY Release client Y.
   * @param isModifierHeld True when Shift, Ctrl or Meta modify the click.
   * @returns True when the release completed a double-click on an object and
   *   Object Properties opened, so the click selection must not run.
   */
  clickRelease(clientX: number, clientY: number, isModifierHeld: boolean): boolean {
    if (isModifierHeld || !this.dependencies.isDoubleClickAllowed()) {
      this.doubleClickForget();
      return false;
    }
    if (!this.pointerDoubleClickDetector.pressRegister(clientX, clientY)) {
      this.selectionBeforeFirstClick = this.selectionSnapshotTake();
      return false;
    }
    const isOpened = this.hitObjectPropertiesOpen(clientX, clientY);
    if (isOpened) {
      this.clickReleasePairOpenDetector.pressRegister(clientX, clientY);
    }
    this.doubleClickForget();
    return isOpened;
  }

  /**
   * Handles the browser's double-click event over a viewport. Opens Object
   * Properties on the object under the pointer unless the click releases of the
   * same double-click already did.
   *
   * @param clientX Double-click client X.
   * @param clientY Double-click client Y.
   * @param isModifierHeld True when Shift, Ctrl or Meta modify the click.
   * @returns True when Object Properties opened.
   */
  nativeDoubleClick(clientX: number, clientY: number, isModifierHeld: boolean): boolean {
    const isAlreadyOpened = this.clickReleasePairOpenDetector.pressRegister(clientX, clientY);
    this.clickReleasePairOpenDetector.reset();
    const isOpened =
      !isAlreadyOpened &&
      !isModifierHeld &&
      this.dependencies.isDoubleClickAllowed() &&
      this.hitObjectPropertiesOpen(clientX, clientY);
    this.doubleClickForget();
    return isOpened;
  }

  /** Forgets the pending first click and its selection snapshot. */
  private doubleClickForget(): void {
    this.pointerDoubleClickDetector.reset();
    this.selectionBeforeFirstClick = null;
  }

  /**
   * Selects the object under a client point and opens Object Properties.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @returns True when an object was hit and the dialog was asked to open.
   */
  private hitObjectPropertiesOpen(clientX: number, clientY: number): boolean {
    const hitMesh = this.hitMeshResolve(clientX, clientY);
    if (!hitMesh) {
      return false;
    }
    this.selectionEnsureForHitMesh(hitMesh);
    this.dependencies.objectPropertiesOpen();
    return true;
  }

  /**
   * Returns the mesh the double-click hit: the picked mesh the first click
   * selected, otherwise the nearest picked mesh.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   * @returns Hit mesh, or null over empty space.
   */
  private hitMeshResolve(clientX: number, clientY: number): THREE.Mesh | null {
    const pickedMeshes = this.dependencies.pickObjectStackAtClientPoint(clientX, clientY);
    const selectedMeshes = this.dependencies.selectionManager.getSelectedObjects();
    return pickedMeshes.find((mesh) => selectedMeshes.has(mesh)) ?? pickedMeshes[0] ?? null;
  }

  /**
   * Restores the multi-selection from before the first click when it held the
   * hit mesh, otherwise makes the hit mesh the only selected object.
   *
   * @param hitMesh Mesh the double-click hit.
   */
  private selectionEnsureForHitMesh(hitMesh: THREE.Mesh): void {
    const snapshot = this.selectionBeforeFirstClick;
    const selectionManager = this.dependencies.selectionManager;
    if (snapshot && snapshot.meshes.includes(hitMesh)) {
      selectionManager.setSelection([...snapshot.meshes], [...snapshot.inspectorObjects]);
      return;
    }
    if (!selectionManager.getSelectedObjects().has(hitMesh)) {
      selectionManager.selectObject(hitMesh);
    }
  }

  /**
   * Captures the current object selection.
   *
   * @returns Selected meshes and their inspector objects.
   */
  private selectionSnapshotTake(): ObjectSelectDoubleClickSelectionSnapshot {
    const selectionManager = this.dependencies.selectionManager;
    return {
      meshes: selectionManager.getAllSelectedObjectsAsArray(),
      inspectorObjects: selectionManager.getInspectorObjects(),
    };
  }
}
