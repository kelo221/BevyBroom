import type * as THREE from 'three';
import { SolidModelCodec } from '@/solid/io/solid_model_codec.js';
import type { ClipboardPayload, ClipboardPayloadVector } from '@/clipboard/payload/clipboard_payload_types.js';

/**
 * Moves everything in a payload by a world-space offset: top-level object
 * entries, top-level brush and group nodes, and the bounds.
 *
 * @param payload Payload changed in place.
 * @param offset World-space translation.
 */
export function clipboardPayloadOffsetApply(payload: ClipboardPayload, offset: THREE.Vector3): void {
  payload.objects
    .filter((entry) => entry.parentId === null)
    .forEach((entry) => clipboardVectorTranslate(entry.position, offset));
  SolidModelCodec.topLevelTransformsRead(payload.brushes).forEach((transform) =>
    clipboardVectorTranslate(transform.position, offset),
  );
  clipboardVectorTranslate(payload.bounds.min, offset);
  clipboardVectorTranslate(payload.bounds.max, offset);
}

/**
 * Adds an offset to a stored vector.
 *
 * @param vector Stored vector changed in place.
 * @param offset Translation to add.
 */
function clipboardVectorTranslate(vector: ClipboardPayloadVector, offset: THREE.Vector3): void {
  vector.x += offset.x;
  vector.y += offset.y;
  vector.z += offset.z;
}
