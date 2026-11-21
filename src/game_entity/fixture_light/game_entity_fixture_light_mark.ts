import type * as THREE from 'three';

/**
 * UserData key holding which variant made a light: the key of the variant the
 * light was built from. Lights without it belong to the designer.
 */
export const GAME_ENTITY_FIXTURE_LIGHT_MARK_USERDATA_KEY = 'fixtureLightOf';

/**
 * Reads and writes the mark a light carries when it was made from the light an
 * enum variant of its parent entity declares.
 */
export class GameEntityFixtureLightMark {
  /**
   * Marks a light as made from a variant.
   *
   * @param light Light owner.
   * @param variantKey Key of the variant the light was built from.
   */
  static write(light: THREE.Object3D, variantKey: string): void {
    light.userData[GAME_ENTITY_FIXTURE_LIGHT_MARK_USERDATA_KEY] = variantKey;
  }

  /**
   * Returns the key of the variant a light was made from.
   *
   * @param light Candidate light owner.
   * @returns Variant key, or null for lights not made from a variant.
   */
  static read(light: THREE.Object3D): string | null {
    const value: unknown = light.userData[GAME_ENTITY_FIXTURE_LIGHT_MARK_USERDATA_KEY];
    return typeof value === 'string' ? value : null;
  }

  /**
   * Returns the children of an entity that were made from a variant.
   *
   * @param owner Entity owner.
   * @returns Marked children in child order.
   */
  static childrenMarked(owner: THREE.Object3D): THREE.Object3D[] {
    return owner.children.filter((child) => GameEntityFixtureLightMark.read(child) !== null);
  }
}
