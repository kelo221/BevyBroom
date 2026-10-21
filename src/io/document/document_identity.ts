import * as THREE from 'three';

/** World-root userData key holding the stable document identifier. */
export const DOCUMENT_IDENTITY_USERDATA_KEY = 'broomDocumentId';

/**
 * Creates a fresh random document identifier.
 *
 * @returns A new identifier string that is unique per created document.
 */
export function documentIdentityCreate(): string {
  return THREE.MathUtils.generateUUID();
}

/**
 * Reads the document identifier stored on a world root without creating one.
 *
 * @param worldGroup Editor world root.
 * @returns The stored identifier, or null when the world has none yet.
 */
export function documentIdentityRead(worldGroup: THREE.Object3D): string | null {
  const storedIdentifier = worldGroup.userData[DOCUMENT_IDENTITY_USERDATA_KEY];
  if (typeof storedIdentifier === 'string' && storedIdentifier.length > 0) {
    return storedIdentifier;
  }
  return null;
}

/**
 * Returns the world root document identifier, creating and storing one when
 * missing.
 *
 * @param worldGroup Editor world root.
 * @returns The stable identifier of the open document.
 */
export function documentIdentityEnsure(worldGroup: THREE.Object3D): string {
  const existingIdentifier = documentIdentityRead(worldGroup);
  if (existingIdentifier !== null) {
    return existingIdentifier;
  }
  const createdIdentifier = documentIdentityCreate();
  documentIdentityWrite(worldGroup, createdIdentifier);
  return createdIdentifier;
}

/**
 * Stores a document identifier on a world root.
 *
 * @param worldGroup Editor world root.
 * @param documentIdentifier Identifier to store; empty strings are replaced by
 *   a fresh identifier.
 */
export function documentIdentityWrite(worldGroup: THREE.Object3D, documentIdentifier: string): void {
  worldGroup.userData[DOCUMENT_IDENTITY_USERDATA_KEY] =
    documentIdentifier.length > 0 ? documentIdentifier : documentIdentityCreate();
}

/**
 * Replaces the world root document identifier with a fresh one, marking the
 * content as a new document.
 *
 * @param worldGroup Editor world root.
 */
export function documentIdentityReset(worldGroup: THREE.Object3D): void {
  documentIdentityWrite(worldGroup, documentIdentityCreate());
}
