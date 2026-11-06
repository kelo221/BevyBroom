import { afterEach, describe, expect, it } from 'vitest';
import { EditorApi } from '@/ai/client/editor_api.js';
import { findMcpTool } from '@/ai/server/registry_mcp_tool.js';
import { EntityClassRegistry } from '@/entity/class/registry/entity_class_registry.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { TEST_DOOR_TYPE_PATH, testClassesInstall } from '../../game_entity/game_entity_test_classes.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';

/** The set_object_class MCP tool converts objects in place on the editor stack. */
describe('EditorApiObjectClass', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('lists set_object_class in the MCP catalog', () => {
    expect(findMcpTool('set_object_class')).toBeDefined();
    expect(findMcpTool('set_object_class')?.inputSchema['required']).toEqual(['ids', 'class']);
  });

  it('converts a light into a door by label and restores the light on undo', () => {
    cleanups.push(testClassesInstall().uninstall);
    const parts = editorApiTestHostCreate();
    const api = new EditorApi(parts.host);
    const created = api.invokeTool('add_light', { name: 'HallLight' });
    const lightId = created.createdIds?.[0];
    expect(created.ok && lightId).toBeTruthy();
    if (!lightId) {
      return;
    }
    const changed = api.invokeTool('set_object_class', { ids: [lightId], class: 'Door' });
    expect(changed.ok, changed.message).toBe(true);
    const object = parts.world.getObjectByProperty('uuid', lightId);
    expect(object?.uuid).toBe(lightId);
    expect(GameEntityOwner.isOwner(object!)).toBe(true);
    expect(LightOwner.isOwner(object!)).toBe(false);
    expect(EntityClassRegistry.classOf(object!)?.label).toBe('Door');
    expect(GameEntityComponentStore.read(object!)).toHaveProperty(TEST_DOOR_TYPE_PATH);
    expect(parts.commandStack.undo()).toBe(true);
    expect(LightOwner.isOwner(object!)).toBe(true);
    expect(GameEntityOwner.isOwner(object!)).toBe(false);
  });

  it('accepts a game type path and refuses an unknown class without changing the object', () => {
    cleanups.push(testClassesInstall().uninstall);
    const parts = editorApiTestHostCreate();
    const api = new EditorApi(parts.host);
    const lightId = api.invokeTool('add_light', {}).createdIds?.[0];
    expect(lightId).toBeDefined();
    if (!lightId) {
      return;
    }
    expect(api.invokeTool('set_object_class', { ids: [lightId], class: TEST_DOOR_TYPE_PATH }).ok).toBe(true);
    const object = parts.world.getObjectByProperty('uuid', lightId);
    expect(GameEntityOwner.isOwner(object!)).toBe(true);
    const refused = api.invokeTool('set_object_class', { ids: [lightId], class: 'no_such_class' });
    expect(refused.ok).toBe(false);
    expect(GameEntityOwner.isOwner(object!)).toBe(true);
  });
});
