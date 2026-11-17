import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import { markAsSolidCsgGroup } from '@/solid/model/solid_group.js';
import type { SerializedSolidTreeNode } from '@/solid/io/solid_model_codec.js';
import { ClipboardPayloadEncoder } from '@/clipboard/payload/clipboard_payload_encoder.js';
import { clipboardPayloadIdentitiesRefresh } from '@/clipboard/payload/clipboard_payload_identity.js';
import { clipboardPayloadOffsetApply } from '@/clipboard/payload/clipboard_payload_offset.js';
import type { ClipboardPayload } from '@/clipboard/payload/clipboard_payload_types.js';
import { clipboardTestBrushAdd, clipboardTestModelAdd } from '../clipboard_test_world.js';

/**
 * Encodes a plain group holding a mesh, and a solid CSG group holding a brush.
 *
 * @returns Payload with object entries, brushes and a group node.
 */
function mixedPayloadCreate(): ClipboardPayload {
  const world = new THREE.Group();
  const plainGroup = new THREE.Group();
  plainGroup.name = 'Props';
  plainGroup.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  world.add(plainGroup);
  const model = clipboardTestModelAdd(world, 'Level');
  const csgGroup = new THREE.Group();
  markAsSolidCsgGroup(csgGroup);
  model.root.add(csgGroup);
  clipboardTestBrushAdd(model, new THREE.Vector3(0, 0, 0), csgGroup);
  const payload = ClipboardPayloadEncoder.encode([plainGroup, csgGroup]);
  if (payload === null) {
    throw new Error('Nothing was encoded');
  }
  return payload;
}

/**
 * Collects the ids of the solid CSG group nodes of a tree.
 *
 * @param nodes Tree nodes.
 * @returns Group node ids.
 */
function groupNodeIdsCollect(nodes: readonly SerializedSolidTreeNode[]): string[] {
  return nodes.flatMap((node) => (node.kind === 'group' ? [node.id, ...groupNodeIdsCollect(node.children)] : []));
}

/** Fresh identities and offsets applied to a clipboard payload before pasting. */
describe('clipboard payload identity and offset', () => {
  it('gives objects, brushes and groups new ids and keeps parent links', () => {
    const payload = mixedPayloadCreate();
    const refreshed = clipboardPayloadIdentitiesRefresh(payload);
    const oldUuids = new Set(payload.objects.map((entry) => entry.uuid));
    refreshed.objects.forEach((entry) => expect(oldUuids.has(entry.uuid)).toBe(false));
    const newUuids = new Set(refreshed.objects.map((entry) => entry.uuid));
    refreshed.objects
      .filter((entry) => entry.parentId !== null)
      .forEach((entry) => expect(newUuids.has(entry.parentId ?? '')).toBe(true));
    const oldBrushIds = new Set(payload.brushes.brushes.map((brush) => brush.id));
    refreshed.brushes.brushes.forEach((brush) => expect(oldBrushIds.has(brush.id)).toBe(false));
    const oldGroupIds = new Set(groupNodeIdsCollect(payload.brushes.hierarchy ?? []));
    const newGroupIds = groupNodeIdsCollect(refreshed.brushes.hierarchy ?? []);
    expect(newGroupIds).toHaveLength(oldGroupIds.size);
    newGroupIds.forEach((id) => expect(oldGroupIds.has(id)).toBe(false));
  });

  it('points entity I/O targets at the renamed copies and keeps targets outside the payload', () => {
    const world = new THREE.Group();
    const lever = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    lever.name = 'Lever';
    const gate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    gate.name = 'Gate';
    world.add(lever, gate);
    GameEntityLogicStore.write(lever, [
      { output: 'OnPull', target: 'Gate', input: 'Open', parameter: '', delay: 0, times_to_fire: -1 },
      { output: 'OnPull', target: 'Siren', input: 'Start', parameter: '', delay: 0, times_to_fire: -1 },
    ]);
    const payload = ClipboardPayloadEncoder.encode([lever, gate]);
    if (payload === null) throw new Error('Nothing was encoded');
    const refreshed = clipboardPayloadIdentitiesRefresh(payload);
    const gateCopyName = refreshed.objects.find(
      (entry) => entry.uuid !== gate.uuid && entry.name !== lever.name && entry.gameLogicOutputs === undefined,
    )?.name;
    const leverCopy = refreshed.objects.find((entry) => (entry.gameLogicOutputs ?? []).length > 0);
    expect(gateCopyName).toBeDefined();
    expect(gateCopyName).not.toBe('Gate');
    expect(leverCopy?.gameLogicOutputs?.map((output) => output.target)).toEqual([gateCopyName, 'Siren']);
  });

  it('leaves the read payload unchanged', () => {
    const payload = mixedPayloadCreate();
    const before = JSON.stringify(payload);
    clipboardPayloadIdentitiesRefresh(payload);
    expect(JSON.stringify(payload)).toBe(before);
  });

  it('moves top-level objects, top-level brush nodes and the bounds by an offset', () => {
    const payload = mixedPayloadCreate();
    const before = JSON.parse(JSON.stringify(payload)) as ClipboardPayload;
    const offset = new THREE.Vector3(3, -2, 5);
    clipboardPayloadOffsetApply(payload, offset);
    expect(payload.bounds.min.x - before.bounds.min.x).toBeCloseTo(offset.x, 9);
    expect(payload.bounds.max.z - before.bounds.max.z).toBeCloseTo(offset.z, 9);
    payload.objects.forEach((entry, index) => {
      const previous = before.objects[index];
      const moved = entry.parentId === null ? offset.x : 0;
      expect(entry.position.x - (previous?.position.x ?? NaN)).toBeCloseTo(moved, 9);
    });
  });
});
