import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { clipboardPayloadTextRead, clipboardPayloadTextWrite } from '@/clipboard/payload/clipboard_payload_text.js';
import { ClipboardPayloadEncoder } from '@/clipboard/payload/clipboard_payload_encoder.js';
import {
  CLIPBOARD_PAYLOAD_FORMAT,
  CLIPBOARD_PAYLOAD_VERSION,
  type ClipboardPayload,
} from '@/clipboard/payload/clipboard_payload_types.js';
import { clipboardTestBrushAdd, clipboardTestBrushMeshRead, clipboardTestModelAdd } from '../clipboard_test_world.js';

/**
 * Encodes one brush of a fresh model placed away from the origin.
 *
 * @returns Payload holding the brush.
 */
function brushPayloadCreate(): ClipboardPayload {
  const world = new THREE.Group();
  const model = clipboardTestModelAdd(world, 'Level');
  model.root.position.set(2, 0, 0);
  const brushMesh = clipboardTestBrushMeshRead(clipboardTestBrushAdd(model, new THREE.Vector3(0, 1, 0)));
  const payload = ClipboardPayloadEncoder.encode([brushMesh]);
  if (payload === null) {
    throw new Error('The brush was not encoded');
  }
  return payload;
}

/** Clipboard text format: what the editor writes and which texts it accepts. */
describe('clipboard payload text', () => {
  it('writes the format, version, world bounds and brushes and reads them back', () => {
    const payload = brushPayloadCreate();
    const text = clipboardPayloadTextWrite(payload);
    const read = clipboardPayloadTextRead(text);
    expect(read).toEqual(JSON.parse(text));
    expect(read?.format).toBe(CLIPBOARD_PAYLOAD_FORMAT);
    expect(read?.version).toBe(CLIPBOARD_PAYLOAD_VERSION);
    expect(read?.brushes.brushes).toHaveLength(1);
    expect(read?.objects).toHaveLength(0);
    const center = new THREE.Vector3(
      ((read?.bounds.min.x ?? 0) + (read?.bounds.max.x ?? 0)) / 2,
      ((read?.bounds.min.y ?? 0) + (read?.bounds.max.y ?? 0)) / 2,
      ((read?.bounds.min.z ?? 0) + (read?.bounds.max.z ?? 0)) / 2,
    );
    expect(center.distanceTo(new THREE.Vector3(2, 1, 0))).toBeLessThan(1e-6);
  });

  it('rejects plain text, foreign JSON, newer versions and broken bounds', () => {
    const text = clipboardPayloadTextWrite(brushPayloadCreate());
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(clipboardPayloadTextRead('hello world')).toBeNull();
    expect(clipboardPayloadTextRead('{"objects":[]}')).toBeNull();
    expect(clipboardPayloadTextRead(JSON.stringify({ ...parsed, format: 'another.app' }))).toBeNull();
    expect(clipboardPayloadTextRead(JSON.stringify({ ...parsed, version: CLIPBOARD_PAYLOAD_VERSION + 1 }))).toBeNull();
    expect(clipboardPayloadTextRead(JSON.stringify({ ...parsed, bounds: { min: { x: 0 } } }))).toBeNull();
    expect(clipboardPayloadTextRead(JSON.stringify({ ...parsed, objects: 'none' }))).toBeNull();
  });

  it('encodes nothing when only the world or nothing is given', () => {
    expect(ClipboardPayloadEncoder.encode([])).toBeNull();
  });
});
