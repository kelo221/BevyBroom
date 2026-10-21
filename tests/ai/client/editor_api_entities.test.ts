import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { PortalOwner } from '@/portal/model/portal_owner.js';
import { portalSettingsCreateDefault } from '@/portal/model/portal_settings.js';
import { RoomOwner } from '@/portal/model/room_owner.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from './editor_api_test_host.js';

/** An EditorApi over a fresh world. */
interface EntityToolsRig extends EditorApiTestHostParts {
  api: EditorApi;
}

/**
 * Builds an EditorApi over a fresh world.
 *
 * @returns The rig.
 */
function entityToolsRigCreate(): EntityToolsRig {
  const parts = editorApiTestHostCreate();
  return { ...parts, api: new EditorApi(parts.host) };
}

/**
 * Returns the id a successful add tool reported.
 *
 * @param result Tool result.
 * @returns New entity id.
 */
function createdIdRead(result: McpToolResult): string {
  const createdId = result.createdIds?.[0];
  if (!result.ok || createdId === undefined) {
    throw new Error(`add failed: ${result.message}`);
  }
  return createdId;
}

/**
 * Finds a world object by id and fails the test when it is missing.
 *
 * @param world World root.
 * @param id Object id.
 * @returns The object.
 */
function worldObjectFind(world: THREE.Group, id: string): THREE.Object3D {
  const object = world.getObjectByProperty('uuid', id);
  if (!object) {
    throw new Error(`no object ${id}`);
  }
  return object;
}

/** Unit tests for the light, room and portal MCP tools. */
describe('EditorApiEntities', () => {
  it('adds a room with the given transform and settings merged over the defaults', () => {
    const rig = entityToolsRigCreate();
    const requestedHalfSizeX = RoomOwner.definition.settingsCreateDefault().halfSizeX + 1;
    const result = rig.api.invokeTool('add_room', {
      name: 'Hall',
      position: { x: 3, y: 1, z: -2 },
      rotationDegrees: { x: 0, y: 90, z: 0 },
      settings: { halfSizeX: requestedHalfSizeX },
    });
    const room = worldObjectFind(rig.world, createdIdRead(result));
    expect(room.name).toBe('Hall');
    expect(room.position.toArray()).toEqual([3, 1, -2]);
    expect(room.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(RoomOwner.settingsRead(room)).toEqual({
      ...RoomOwner.definition.settingsCreateDefault(),
      halfSizeX: requestedHalfSizeX,
    });
  });

  it('adds a portal and a light that undo removes from the world', () => {
    const rig = entityToolsRigCreate();
    const portalId = createdIdRead(rig.api.invokeTool('add_portal', {}));
    const lightId = createdIdRead(rig.api.invokeTool('add_light', { settings: { intensity: 7 } }));
    expect(PortalOwner.settingsRead(worldObjectFind(rig.world, portalId))).toEqual(portalSettingsCreateDefault());
    expect(LightOwner.settingsRead(worldObjectFind(rig.world, lightId))?.intensity).toBe(7);
    rig.commandStack.undo();
    rig.commandStack.undo();
    expect(rig.world.getObjectByProperty('uuid', portalId)).toBeUndefined();
    expect(rig.world.getObjectByProperty('uuid', lightId)).toBeUndefined();
  });

  it('closes a portal as one undoable settings edit', () => {
    const rig = entityToolsRigCreate();
    const portalId = createdIdRead(rig.api.invokeTool('add_portal', {}));
    const result = rig.api.invokeTool('set_portal_settings', { id: portalId, settings: { closed: true } });
    const portal = worldObjectFind(rig.world, portalId);
    expect(result.ok).toBe(true);
    expect(PortalOwner.settingsRead(portal)).toEqual({ ...portalSettingsCreateDefault(), closed: true });
    rig.commandStack.undo();
    expect(PortalOwner.settingsRead(portal)?.closed).toBe(false);
  });

  it('changes light settings and keeps the settings it was not given', () => {
    const rig = entityToolsRigCreate();
    const lightId = createdIdRead(rig.api.invokeTool('add_light', {}));
    rig.api.invokeTool('set_light_settings', { id: lightId, settings: { realtime: true } });
    const settings = LightOwner.settingsRead(worldObjectFind(rig.world, lightId));
    expect(settings).toEqual({ ...lightSettingsCreateDefault(settings?.kind ?? 'point'), realtime: true });
  });

  it('refuses a settings edit when the id names an entity of another kind', () => {
    const rig = entityToolsRigCreate();
    const roomId = createdIdRead(rig.api.invokeTool('add_room', {}));
    const result = rig.api.invokeTool('set_portal_settings', { id: roomId, settings: { closed: true } });
    expect(result.ok).toBe(false);
    expect(rig.commandStack.undo()).toBe(true);
    expect(rig.commandStack.undo()).toBe(false);
  });
});
