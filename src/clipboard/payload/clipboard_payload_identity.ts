import * as THREE from 'three';
import type { ObjectEntry } from '@/io/scene/io_types.js';
import type { SerializedSolidModel, SerializedSolidTreeNode } from '@/solid/io/solid_model_codec.js';
import { remapSerializedSolidIdentities } from '@/solid/model/solid_model_duplicate.js';
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
 * Gives object entries new uuids, relinks their parents, renames content
 * entries and points entity I/O targets at the renamed copies.
 *
 * @param entries Entries changed in place.
 */
function clipboardEntriesIdentitiesRefresh(entries: ObjectEntry[]): void {
  const uuidByOld = new Map(entries.map((entry) => [entry.uuid, THREE.MathUtils.generateUUID()] as const));
  const nameByOld = new Map<string, string>();
  entries.forEach((entry) => {
    entry.uuid = uuidByOld.get(entry.uuid) ?? THREE.MathUtils.generateUUID();
    entry.parentId = entry.parentId === null ? null : (uuidByOld.get(entry.parentId) ?? null);
    clipboardEntryNameRefresh(entry, nameByOld);
    if (entry.solidModel) {
      clipboardSolidIdentitiesRefresh(entry.solidModel as unknown as SerializedSolidModel);
    }
  });
  entries.forEach((entry) => clipboardEntryLogicTargetsRename(entry, nameByOld));
}

/**
 * Gives a mesh or group entry a fresh hierarchy name and remembers the rename;
 * entity entries keep their names.
 *
 * @param entry Entry changed in place.
 * @param nameByOld Receives the new name under the old one.
 */
function clipboardEntryNameRefresh(entry: ObjectEntry, nameByOld: Map<string, string>): void {
  if (entry.type === 'mesh' || entry.type === 'group') {
    const newName = hierarchyNameAllocator.allocateFromSourceName(entry.name);
    nameByOld.set(entry.name, newName);
    entry.name = newName;
  }
}

/**
 * Points the entity I/O outputs of an entry at the new names of renamed copied
 * objects; targets outside the payload stay as they are.
 *
 * @param entry Entry changed in place.
 * @param nameByOld New names by old name.
 */
function clipboardEntryLogicTargetsRename(entry: ObjectEntry, nameByOld: ReadonlyMap<string, string>): void {
  const outputs = entry.gameLogicOutputs;
  if (outputs === undefined) {
    return;
  }
  entry.gameLogicOutputs = outputs.map((output) => ({
    ...output,
    target: nameByOld.get(output.target) ?? output.target,
  }));
}

/**
 * Gives serialized solid content new brush, group and volume ids and names.
 *
 * @param solid Solid content changed in place.
 */
function clipboardSolidIdentitiesRefresh(solid: SerializedSolidModel): void {
  remapSerializedSolidIdentities(solid);
  solid.brushes.forEach((brush) => {
    brush.name = hierarchyNameAllocator.allocateFromSourceName(brush.name);
  });
  (solid.hierarchy ?? []).forEach((node) => clipboardSolidTreeNodeNameRefresh(node));
}

/**
 * Gives a solid CSG group or modifier volume node, and the groups and volumes
 * nested in it, new hierarchy names.
 *
 * @param node Tree node changed in place; brush leaves are left alone.
 */
function clipboardSolidTreeNodeNameRefresh(node: SerializedSolidTreeNode): void {
  if (node.kind === 'brush') {
    return;
  }
  node.name = hierarchyNameAllocator.allocateFromSourceName(node.name);
  if (node.kind === 'group') node.children.forEach((child) => clipboardSolidTreeNodeNameRefresh(child));
}
