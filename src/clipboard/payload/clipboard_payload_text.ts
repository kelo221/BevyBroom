import {
  CLIPBOARD_PAYLOAD_FORMAT,
  CLIPBOARD_PAYLOAD_VERSION,
  type ClipboardPayload,
  type ClipboardPayloadBounds,
} from '@/clipboard/payload/clipboard_payload_types.js';

/**
 * Writes a clipboard payload as the text placed on the system clipboard.
 *
 * @param payload Payload to write.
 * @returns JSON text.
 */
export function clipboardPayloadTextWrite(payload: ClipboardPayload): string {
  return JSON.stringify(payload);
}

/**
 * Reads clipboard text written by the editor.
 *
 * @param text Text taken from the clipboard.
 * @returns The payload, or null when the text is not an editor clipboard
 *   payload of a supported version.
 */
export function clipboardPayloadTextRead(text: string): ClipboardPayload | null {
  const parsed = clipboardPayloadJsonParse(text);
  return clipboardPayloadShapeValidIs(parsed) ? parsed : null;
}

/**
 * Parses JSON text without throwing.
 *
 * @param text Candidate JSON text.
 * @returns Parsed value, or null when the text is not JSON.
 */
function clipboardPayloadJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * Returns whether a parsed value has the shape of a supported payload.
 *
 * @param value Parsed clipboard value.
 * @returns True for editor payloads of a supported version.
 */
function clipboardPayloadShapeValidIs(value: unknown): value is ClipboardPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<ClipboardPayload>;
  if (candidate.format !== CLIPBOARD_PAYLOAD_FORMAT || !clipboardPayloadVersionSupportedIs(candidate.version)) {
    return false;
  }
  const brushesValid = typeof candidate.brushes === 'object' && Array.isArray(candidate.brushes?.brushes);
  return Array.isArray(candidate.objects) && brushesValid && clipboardPayloadBoundsValidIs(candidate.bounds);
}

/**
 * Returns whether a payload version can be read.
 *
 * @param version Stored version.
 * @returns True for whole versions from 1 to the current version.
 */
function clipboardPayloadVersionSupportedIs(version: unknown): boolean {
  return (
    typeof version === 'number' && Number.isInteger(version) && version >= 1 && version <= CLIPBOARD_PAYLOAD_VERSION
  );
}

/**
 * Returns whether stored bounds hold finite min and max corners.
 *
 * @param bounds Stored bounds.
 * @returns True when both corners are finite vectors.
 */
function clipboardPayloadBoundsValidIs(bounds: ClipboardPayloadBounds | undefined): boolean {
  if (typeof bounds !== 'object' || bounds === null) {
    return false;
  }
  return [bounds.min, bounds.max].every(
    (corner) =>
      typeof corner === 'object' &&
      corner !== null &&
      [corner.x, corner.y, corner.z].every((component) => typeof component === 'number' && Number.isFinite(component)),
  );
}
