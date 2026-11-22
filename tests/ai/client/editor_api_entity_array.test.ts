import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import { EntityArrayCopyMark } from '@/entity_array/model/entity_array_copy_mark.js';
import { EntityArrayStore } from '@/entity_array/model/entity_array_store.js';
import { EntityArrayFollower } from '@/entity_array/sync/entity_array_follower.js';
import { gameEntityCreateForClass } from '@/game_entity/owner/game_entity_owner.js';
import { CommandPrimitiveCreate } from '@/tools/creation/commands/command_primitive_create.js';
import { entityArrayTestShelfClassCreate } from '../../entity_array/entity_array_test_rig.js';
import { testClassesInstall, testClassListCreate } from '../../game_entity/game_entity_test_classes.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';

/** API, world and placed shelf of one test. */
interface EntityArrayApiRig {
  readonly api: EditorApi;
  readonly world: THREE.Group;
  readonly shelf: THREE.Object3D;
}

/**
 * Builds an EditorApi whose undo stack the array follower follows, with one
 * shelf placed.
 *
 * @param cleanups Receives the uninstall callbacks.
 * @returns Test rig.
 */
function rigCreate(cleanups: (() => void)[]): EntityArrayApiRig {
  const shelfClass = entityArrayTestShelfClassCreate();
  const list = testClassListCreate();
  list.classes = [shelfClass];
  cleanups.push(testClassesInstall(list).uninstall);
  const parts = editorApiTestHostCreate();
  cleanups.push(new EntityArrayFollower(parts.world).follow(parts.commandStack));
  const shelf = gameEntityCreateForClass(shelfClass, { [shelfClass.type_path]: { fixture: 'tall' } });
  parts.commandStack.push(new CommandPrimitiveCreate(shelf, parts.world));
  return { api: new EditorApi(parts.host), world: parts.world, shelf };
}

/** The array MCP tools make entities repeat and bake their copies. */
describe('EditorApiEntityArray', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('makes an entity repeat over the defaults and reports the copies', () => {
    const rig = rigCreate(cleanups);
    const countZ = 3;
    const result = rig.api.invokeTool('set_entity_array', { id: rig.shelf.uuid, array: { count_z: countZ } });
    expect(result.ok).toBe(true);
    const data = result.data as { copyIds: string[]; array: Record<string, unknown> };
    const settings = EntityArrayStore.read(rig.shelf);
    expect(settings?.counts.z).toBe(countZ);
    const expectedCopies = (settings?.counts.x ?? 0) * countZ - 1;
    expect(data.copyIds).toHaveLength(expectedCopies);
    expect(data.copyIds).toEqual(EntityArrayCopyMark.copiesOf(rig.shelf).map((copy) => copy.uuid));
  });

  it('stops repeating with null and refuses copies and unknown ids', () => {
    const rig = rigCreate(cleanups);
    const first = rig.api.invokeTool('set_entity_array', { id: rig.shelf.uuid, array: { count_x: 4 } });
    const copyId = (first.data as { copyIds: string[] }).copyIds[0] ?? '';
    expect(rig.api.invokeTool('set_entity_array', { id: copyId, array: { count_x: 2 } }).ok).toBe(false);
    expect(rig.api.invokeTool('set_entity_array', { id: 'missing', array: {} }).ok).toBe(false);
    expect(rig.api.invokeTool('set_entity_array', { id: rig.shelf.uuid, array: 'wide' }).ok).toBe(false);
    expect(rig.api.invokeTool('set_entity_array', { id: rig.shelf.uuid, array: null }).ok).toBe(true);
    expect(EntityArrayCopyMark.copiesOf(rig.shelf)).toHaveLength(0);
  });

  it('bakes the copies into entities beside the source', () => {
    const rig = rigCreate(cleanups);
    rig.api.invokeTool('set_entity_array', { id: rig.shelf.uuid, array: { count_x: 3 } });
    const result = rig.api.invokeTool('bake_entity_array', { id: rig.shelf.uuid });
    expect(result.ok).toBe(true);
    const bakedIds = (result.data as { bakedIds: string[] }).bakedIds;
    expect(bakedIds).toHaveLength(2);
    bakedIds.forEach((id) => expect(rig.world.getObjectByProperty('uuid', id)?.parent).toBe(rig.world));
    expect(rig.api.invokeTool('bake_entity_array', { id: rig.shelf.uuid }).ok).toBe(false);
  });
});
