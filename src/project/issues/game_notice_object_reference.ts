import type * as THREE from 'three';

/** Names the scene object a game warning is about. */
export interface GameNoticeObjectReference {
  /** Name the game printed for the object. */
  readonly objectName: string;
  /** Uuid the game printed for the object, or null when it printed none. */
  readonly objectId: string | null;
}

/**
 * A game warning: `<name> (<object_id>): <why>, so it is left out.` with the
 * brackets optional.
 */
const GAME_NOTICE_OBJECT_PATTERN = /^(.+?)(?: \(([^()\s]+)\))?: .+, so it is left out\.$/;

/**
 * Reads which object a game warning is about.
 *
 * @param message Warning text without the leading `warning: `.
 * @returns The named object, or null when the text is not such a warning.
 */
export function gameNoticeObjectReferenceParse(message: string): GameNoticeObjectReference | null {
  const match = GAME_NOTICE_OBJECT_PATTERN.exec(message.trim());
  if (match === null) {
    return null;
  }
  return { objectName: match[1] ?? '', objectId: match[2] ?? null };
}

/**
 * Lists the objects below a root that carry a name.
 *
 * @param worldObject Root searched, itself included.
 * @param objectName Name to look for.
 * @returns Every object with that name.
 */
function gameNoticeObjectsNamedCollect(worldObject: THREE.Object3D, objectName: string): THREE.Object3D[] {
  const named: THREE.Object3D[] = [];
  worldObject.traverse((object) => {
    if (object.name === objectName) {
      named.push(object);
    }
  });
  return named;
}

/**
 * Finds the object a game warning is about: the one whose uuid equals the
 * printed id, or, when no id was printed, the only one with the printed name.
 *
 * @param reference Object the warning names.
 * @param worldObject Root searched.
 * @returns The object, or null when it is missing or the name is ambiguous.
 */
export function gameNoticeObjectFind(
  reference: GameNoticeObjectReference,
  worldObject: THREE.Object3D,
): THREE.Object3D | null {
  if (reference.objectId !== null) {
    return worldObject.getObjectByProperty('uuid', reference.objectId) ?? null;
  }
  const named = gameNoticeObjectsNamedCollect(worldObject, reference.objectName);
  return named.length === 1 ? (named[0] ?? null) : null;
}
