import * as THREE from 'three';

/** Material userData key holding the texture or game material identifier. */
export const MATERIAL_IDENTITY_USERDATA_KEY = 'broomMaterialId';

/** Export extras key that names the game material of a glTF material. */
export const MATERIAL_IDENTITY_EXPORT_EXTRAS_KEY = 'broom_material';

/**
 * Stores the material identifier on a material.
 *
 * @param material Material to stamp.
 * @param materialIdentifier Texture or game material identifier.
 */
export function materialIdentityWrite(material: THREE.Material, materialIdentifier: string): void {
  material.userData[MATERIAL_IDENTITY_USERDATA_KEY] = materialIdentifier;
}

/**
 * Reads the material identifier stored on a material.
 *
 * @param material Material to inspect.
 * @returns The stored identifier, or null when the material was never stamped.
 */
export function materialIdentityRead(material: THREE.Material): string | null {
  const storedIdentifier = material.userData[MATERIAL_IDENTITY_USERDATA_KEY];
  if (typeof storedIdentifier === 'string' && storedIdentifier.length > 0) {
    return storedIdentifier;
  }
  return null;
}
