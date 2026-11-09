import type * as THREE from 'three';

/**
 * UserData key holding the name of the sprinkle definition that created an
 * object. Only objects carrying it are touched by the Sprinkle tool.
 */
export const SPRINKLE_MARK_USERDATA_KEY = 'sprinkleDefinition';

/**
 * Reads and writes the mark the Sprinkle tool leaves on the entities it
 * creates.
 */
export class SprinkleMark {
  /**
   * Marks an object as created by the Sprinkle tool.
   *
   * @param object Scene object.
   * @param definitionName Name of the definition that created it.
   */
  static write(object: THREE.Object3D, definitionName: string): void {
    object.userData[SPRINKLE_MARK_USERDATA_KEY] = definitionName;
  }

  /**
   * Returns the definition name an object was sprinkled with.
   *
   * @param object Scene object.
   * @returns Definition name, or null when the Sprinkle tool did not create it.
   */
  static read(object: THREE.Object3D): string | null {
    const value: unknown = object.userData[SPRINKLE_MARK_USERDATA_KEY];
    return typeof value === 'string' ? value : null;
  }

  /**
   * Returns whether the Sprinkle tool created an object.
   *
   * @param object Scene object.
   * @returns True for sprinkled objects.
   */
  static is(object: THREE.Object3D): boolean {
    return SprinkleMark.read(object) !== null;
  }

  /**
   * Collects every sprinkled object under a root, in traversal order.
   *
   * @param root Scene root.
   * @returns Sprinkled objects.
   */
  static objectsCollect(root: THREE.Object3D): THREE.Object3D[] {
    const sprinkled: THREE.Object3D[] = [];
    root.traverse((object) => {
      if (object !== root && SprinkleMark.is(object)) {
        sprinkled.push(object);
      }
    });
    return sprinkled;
  }
}
