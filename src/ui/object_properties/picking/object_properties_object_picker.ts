import type * as THREE from 'three';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';

/** Selection captured when picking began, restored once the pick is taken. */
interface ObjectPropertiesPickerSnapshot {
  readonly meshes: THREE.Mesh[];
  readonly inspectorObjects: THREE.Object3D[];
}

/**
 * Lets the user pick one object with the editor's normal selection clicks
 * without losing the edited selection: the next selection change is read as the
 * pick, then the previous selection comes back.
 */
export class ObjectPropertiesObjectPicker {
  private readonly selectionManager: ManagerSelection;
  private onPicked: ((object: THREE.Object3D) => void) | null;
  private snapshot: ObjectPropertiesPickerSnapshot | null;
  private isRestoring: boolean;

  /**
   * Creates an idle picker.
   *
   * @param selectionManager Selection the pick clicks change.
   */
  constructor(selectionManager: ManagerSelection) {
    this.selectionManager = selectionManager;
    this.onPicked = null;
    this.snapshot = null;
    this.isRestoring = false;
  }

  /**
   * Starts waiting for a pick, replacing any pick that was waiting.
   *
   * @param onPicked Called with the picked object.
   */
  begin(onPicked: (object: THREE.Object3D) => void): void {
    this.onPicked = onPicked;
    this.snapshot = {
      meshes: this.selectionManager.getAllSelectedObjectsAsArray(),
      inspectorObjects: this.selectionManager.getInspectorObjects(),
    };
  }

  /**
   * Returns whether a pick is awaited.
   *
   * @returns True between begin and the next selection change.
   */
  isActive(): boolean {
    return this.onPicked !== null;
  }

  /** Stops waiting without picking. */
  cancel(): void {
    this.onPicked = null;
    this.snapshot = null;
  }

  /**
   * Handles a selection change: takes it as the pick while one is awaited and
   * restores the edited selection.
   *
   * @returns True when the change belonged to picking and must be ignored by
   *   the caller.
   */
  selectionChangeConsume(): boolean {
    if (this.isRestoring) {
      return true;
    }
    const onPicked = this.onPicked;
    const snapshot = this.snapshot;
    if (!onPicked || !snapshot) {
      return false;
    }
    const picked = this.pickedObjectFind(snapshot);
    this.cancel();
    this.selectionRestore(snapshot);
    if (picked) {
      onPicked(picked);
    }
    return true;
  }

  /**
   * Finds the first newly selected object that was not part of the edited
   * selection.
   *
   * @param snapshot Edited selection.
   * @returns Picked object, or null when the click picked nothing new.
   */
  private pickedObjectFind(snapshot: ObjectPropertiesPickerSnapshot): THREE.Object3D | null {
    const edited = new Set<THREE.Object3D>(snapshot.inspectorObjects);
    return this.selectionManager.getInspectorObjects().find((object) => !edited.has(object)) ?? null;
  }

  /**
   * Restores the edited selection while ignoring the change it causes.
   *
   * @param snapshot Edited selection.
   */
  private selectionRestore(snapshot: ObjectPropertiesPickerSnapshot): void {
    this.isRestoring = true;
    try {
      this.selectionManager.setSelection(snapshot.meshes, snapshot.inspectorObjects);
    } finally {
      this.isRestoring = false;
    }
  }
}
