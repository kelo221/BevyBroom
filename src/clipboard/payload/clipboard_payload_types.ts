import type { ObjectEntry } from '@/io/scene/io_types.js';
import type { SerializedSolidModel } from '@/solid/io/solid_model_codec.js';

/** Format marker every clipboard text written by the editor carries. */
export const CLIPBOARD_PAYLOAD_FORMAT = 'bevybroom.clipboard';

/** Newest clipboard payload version the editor writes and reads. */
export const CLIPBOARD_PAYLOAD_VERSION = 1;

/** Plain xyz components of a clipboard payload. */
export interface ClipboardPayloadVector {
  x: number;
  y: number;
  z: number;
}

/** World-space axis-aligned bounds of everything a payload holds. */
export interface ClipboardPayloadBounds {
  min: ClipboardPayloadVector;
  max: ClipboardPayloadVector;
}

/**
 * Text representation of copied objects. Top-level object entries and top-level
 * brush and group nodes carry world-space transforms; their descendants keep
 * transforms local to their parents.
 */
export interface ClipboardPayload {
  /** Always {@link CLIPBOARD_PAYLOAD_FORMAT}. */
  format: typeof CLIPBOARD_PAYLOAD_FORMAT;
  /** Payload version, at most {@link CLIPBOARD_PAYLOAD_VERSION}. */
  version: number;
  /** Scene file entries of solid models, entity owners, meshes and groups. */
  objects: ObjectEntry[];
  /** Brushes and solid CSG groups copied out of solid models. */
  brushes: SerializedSolidModel;
  /** World-space bounds of the copied content. */
  bounds: ClipboardPayloadBounds;
}
