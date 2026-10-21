import * as THREE from 'three';
import type { ObjectEntry } from '@/io/scene/io_types.js';
import type { SerializedSolidModel, SerializedSolidTreeNode } from '@/solid/io/solid_model_codec.js';
import { remapSerializedSolidBrushIdentities } from '@/solid/model/solid_model_duplicate.js';
import { hierarchyNameAllocator } from '@/utils/utils_hierarchy_name_allocator.js';
import type { ClipboardPayload } from '@/clipboard/payload/clipboard_payload_types.js';

/**
 * Copies a payload and gives everything in the copy fresh identities: new
 * object uuids, new brush ids and new hierarchy names for meshes, groups, solid
 * models, brushes and solid CSG groups. Entity owners keep their names like
 * duplicates do, and every other stored datum such as game components is kept.
 *
 * @param payload Payload read from the clipboard; left unchanged.
 * @returns Independent payload with fresh identities.
 */
export function clipboardPayloadIdentitiesRefresh(payload: ClipboardPayload): ClipboardPayload {
  const copy = JSON.parse(JSON.stringify(payload)) as ClipboardPayload;
  clipboardEntriesIdentitiesRefresh(copy.objects);
  clipboardSolidIdentitiesRefresh(copy.brushes);
  return copy;
}

/**
 * Gives object entries new uuids, relinks their parents and renames content
 * entries.
 *
 * @param entries Entries changed in place.
 */
function clipboardEntriesIdentitiesRefresh(entries: ObjectEntry[]): void {
  const uuidByOld = new Map(entries.map((entry) => [entry.uuid, THREE.MathUtils.generateUUID()] as const));
  entries.forEach((entry) => {
    entry.uuid = uuidByOld.get(entry.uuid) ?? THREE.MathUtils.generateUUID();
    entry.parentId = entry.parentId === null ? null : (uuidByOld.get(entry.parentId) ?? null);
    clipboardEntryNameRefresh(entry);
    if (entry.solidModel) {
      clipboardSolidIdentitiesRefresh(entry.solidModel as unknown as SerializedSolidModel);
    }
  });
}

/**
 * Gives a mesh or group entry a fresh hierarchy name; entity entries keep their
 * names.
 *
 * @param entry Entry changed in place.
 */
function clipboardEntryNameRefresh(entry: ObjectEntry): void {
  if (entry.type === 'mesh' || entry.type === 'group') {
    entry.name = hierarchyNameAllocator.allocateFromSourceName(entry.name);
  }
}

/**
 * Gives serialized solid content new brush ids, group ids and names.
 *
 * @param solid Solid content changed in place.
 */
function clipboardSolidIdentitiesRefresh(solid: SerializedSolidModel): void {
  remapSerializedSolidBrushIdentities(solid);
  solid.brushes.forEach((brush) => {
    brush.name = hierarchyNameAllocator.allocateFromSourceName(brush.name);
  });
  (solid.hierarchy ?? []).forEach((node) => clipboardSolidTreeNodeIdentityRefresh(node));
}

/**
 * Gives a solid CSG group node and its nested groups new ids and names.
 *
 * @param node Tree node changed in place; brush leaves are left alone.
 */
function clipboardSolidTreeNodeIdentityRefresh(node: SerializedSolidTreeNode): void {
  if (node.kind === 'brush') {
    return;
  }
  node.id = THREE.MathUtils.generateUUID();
  node.name = hierarchyNameAllocator.allocateFromSourceName(node.name);
  node.children.forEach((child) => clipboardSolidTreeNodeIdentityRefresh(child));
}
