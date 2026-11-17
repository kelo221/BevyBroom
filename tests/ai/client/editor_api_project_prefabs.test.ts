import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import { findMcpTool } from '@/ai/server/registry_mcp_tool.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { getPrefabCatalogStore } from '@/prefab/prefab_catalog_store.js';
import { selectionMeshesFromHierarchyCollect } from '@/selection/object/selection_hierarchy_meshes.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';

/** Data of a list_prefabs result. */
interface PrefabListData {
  prefabs: { id: string; name: string; category: string; objectCount: number; isProjectFile: boolean }[];
}

/**
 * Builds an editor API over a world with one selected light.
 *
 * @returns API, test host parts and the light.
 */
function prefabApiCreate() {
  const parts = editorApiTestHostCreate();
  const api = new EditorApi(parts.host);
  const light = LightOwner.create('Aisle Lamp', lightSettingsCreateDefault('point'));
  light.position.set(4, 3, -2);
  parts.world.add(light);
  parts.host.selectionManager.setSelection(selectionMeshesFromHierarchyCollect([light]), [light]);
  return { api, parts, light };
}

/** Unit tests for the list, create, place and delete prefab MCP tools. */
describe('EditorApi prefab tools', () => {
  afterEach(() => {
    const store = getPrefabCatalogStore();
    store.templatesRead().forEach((template) => store.templateRemove(template.id));
  });

  it('lists every prefab tool in the MCP catalog', () => {
    ['list_prefabs', 'create_prefab', 'place_prefab', 'update_prefab', 'delete_prefab'].forEach((name) =>
      expect(findMcpTool(name)).toBeDefined(),
    );
  });

  it('creates a prefab from the selection, places a copy at a position and deletes it, each undoable', async () => {
    const { api, parts, light } = prefabApiCreate();
    const created = await api.invokeToolAsync('create_prefab', { name: 'Aisle Lamp', category: 'Lights' });
    expect(created.ok).toBe(true);
    const prefabId = (created.data as { id: string }).id;
    const listed = (await api.invokeToolAsync('list_prefabs')).data as PrefabListData;
    expect(listed.prefabs).toEqual([
      expect.objectContaining({ id: prefabId, category: 'Lights', objectCount: 1, isProjectFile: false }),
    ]);
    const target = { x: light.position.x + 10, y: 0, z: light.position.z - 5 };
    const placed = await api.invokeToolAsync('place_prefab', { prefabId, position: target });
    expect(placed.ok).toBe(true);
    const placedId = placed.createdIds?.[0] ?? '';
    const placedLight = parts.world.getObjectByProperty('uuid', placedId);
    expect(LightOwner.settingsRead(placedLight ?? new THREE.Object3D())).not.toBeNull();
    expect(placedLight?.position.x).toBeCloseTo(target.x);
    expect(placedLight?.position.z).toBeCloseTo(target.z);
    parts.host.commandStack.undo();
    expect(parts.world.getObjectByProperty('uuid', placedId)).toBeUndefined();
    expect((await api.invokeToolAsync('delete_prefab', { prefabId })).ok).toBe(true);
    expect(((await api.invokeToolAsync('list_prefabs')).data as PrefabListData).prefabs).toEqual([]);
    parts.host.commandStack.undo();
    expect(((await api.invokeToolAsync('list_prefabs')).data as PrefabListData).prefabs.length).toBe(1);
  });

  it('renames and recategorizes a prefab under the same id, undoably, and refuses an unknown one', async () => {
    const { api, parts } = prefabApiCreate();
    const prefabId = ((await api.invokeToolAsync('create_prefab', { name: 'Aisle Lamp' })).data as { id: string }).id;
    const updated = await api.invokeToolAsync('update_prefab', { prefabId, name: 'Ceiling Lamp', category: 'Lights' });
    expect(updated.data).toEqual(expect.objectContaining({ id: prefabId, name: 'Ceiling Lamp', category: 'Lights' }));
    const kept = await api.invokeToolAsync('update_prefab', { prefabId, name: '  ' });
    expect(kept.data).toEqual(expect.objectContaining({ name: 'Ceiling Lamp' }));
    parts.host.commandStack.undo();
    parts.host.commandStack.undo();
    const listed = ((await api.invokeToolAsync('list_prefabs')).data as PrefabListData).prefabs;
    expect(listed).toEqual([expect.objectContaining({ id: prefabId, name: 'Aisle Lamp', category: 'Prefabs' })]);
    expect((await api.invokeToolAsync('update_prefab', { prefabId: 'missing', name: 'X' })).ok).toBe(false);
  });

  it('refuses an empty selection, a missing name and an unknown prefab', async () => {
    const { api, parts } = prefabApiCreate();
    expect((await api.invokeToolAsync('create_prefab', {})).ok).toBe(false);
    parts.host.selectionManager.setSelection([], []);
    expect((await api.invokeToolAsync('create_prefab', { name: 'Nothing' })).ok).toBe(false);
    expect((await api.invokeToolAsync('place_prefab', { prefabId: 'missing' })).ok).toBe(false);
  });
});
