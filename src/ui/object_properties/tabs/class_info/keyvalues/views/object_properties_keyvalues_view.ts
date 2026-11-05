import type * as THREE from 'three';

/**
 * One way the keyvalue table shows the edited objects' keyvalues, such as field
 * editors with SmartEdit on or plain text with SmartEdit off.
 */
export abstract class ObjectPropertiesKeyvaluesView {
  /**
   * Returns the elements the table shows; they hold labeled field rows.
   *
   * @returns Content elements in display order.
   */
  abstract contentRead(): HTMLElement[];

  /**
   * Shows the keyvalues of the edited objects.
   *
   * @param objects Edited objects.
   */
  abstract refresh(objects: readonly THREE.Object3D[]): void;
}
