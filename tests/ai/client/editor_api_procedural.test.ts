import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import {
  PROCEDURAL_GENERATOR_BOX_CORNER_A,
  PROCEDURAL_GENERATOR_BOX_CORNER_B,
  PROCEDURAL_GENERATOR_BOX_ID,
} from '@/procedural/generator/box/procedural_generator_box.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import { ProceduralSettingsRules } from '@/procedural/model/procedural_settings_rules.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';

/**
 * Builds an EditorApi over a fresh world.
 *
 * @returns The API and its world.
 */
function rigCreate(): { api: EditorApi; world: THREE.Group } {
  const parts = editorApiTestHostCreate();
  return { api: new EditorApi(parts.host), world: parts.world };
}

/**
 * Returns the object a successful add tool created.
 *
 * @param world World root.
 * @param result Tool result.
 * @returns The created object.
 */
function createdObjectRead(world: THREE.Group, result: McpToolResult): THREE.Object3D {
  const id = result.createdIds?.[0];
  const object = id === undefined ? undefined : world.getObjectByProperty('uuid', id);
  if (!result.ok || !object) {
    throw new Error(`add failed: ${result.message}`);
  }
  return object;
}

/** The procedural MCP tools list generators and add and edit procedural objects. */
describe('EditorApiProcedural', () => {
  it('lists every generator with its fields, handles and defaults', () => {
    const result = rigCreate().api.invokeTool('list_procedural_generators', {});
    const data = result.data as {
      generators: { id: string; handlePoints: string[]; handleFaces: string[]; defaultParameters: object }[];
    };
    expect(data.generators.map((generator) => generator.id)).toEqual(
      ProceduralGeneratorRegistry.list().map((generator) => generator.generatorId),
    );
    const box = data.generators.find((generator) => generator.id === PROCEDURAL_GENERATOR_BOX_ID);
    expect(box?.handlePoints).toEqual([]);
    expect(box?.handleFaces).toHaveLength(6);
    expect(box?.handleFaces).toContain('max_y');
    expect(box?.defaultParameters).toEqual(ProceduralSettingsRules.createDefault().parameters);
  });

  it('adds a box with the requested corner over the defaults, undoably', () => {
    const rig = rigCreate();
    const cornerB = [2, 3, 4];
    const result = rig.api.invokeTool('add_procedural', {
      position: { x: 1, y: 0, z: -2 },
      settings: { parameters: { [PROCEDURAL_GENERATOR_BOX_CORNER_B]: cornerB } },
    });
    const owner = createdObjectRead(rig.world, result);
    const settings = ProceduralOwner.settingsRead(owner);
    expect(owner.position.toArray()).toEqual([1, 0, -2]);
    expect(settings?.parameters[PROCEDURAL_GENERATOR_BOX_CORNER_B]).toEqual(cornerB);
    expect(settings?.parameters[PROCEDURAL_GENERATOR_BOX_CORNER_A]).toEqual(
      ProceduralSettingsRules.createDefault().parameters[PROCEDURAL_GENERATOR_BOX_CORNER_A],
    );
    rig.api.invokeTool('undo', {});
    expect(ProceduralOwner.collectUnder(rig.world)).toHaveLength(0);
  });

  it('refuses an unknown generator', () => {
    const result = rigCreate().api.invokeTool('add_procedural', { settings: { generatorId: 'nope' } });
    expect(result.ok).toBe(false);
  });

  it('changes one parameter and keeps the others', () => {
    const rig = rigCreate();
    const owner = createdObjectRead(rig.world, rig.api.invokeTool('add_procedural', {}));
    const before = ProceduralOwner.settingsRead(owner);
    const cornerA = [-3, -1, -2];
    const result = rig.api.invokeTool('set_procedural_settings', {
      id: owner.uuid,
      settings: { parameters: { [PROCEDURAL_GENERATOR_BOX_CORNER_A]: cornerA } },
    });
    expect(result.ok).toBe(true);
    const after = ProceduralOwner.settingsRead(owner);
    expect(after?.parameters[PROCEDURAL_GENERATOR_BOX_CORNER_A]).toEqual(cornerA);
    expect(after?.parameters[PROCEDURAL_GENERATOR_BOX_CORNER_B]).toEqual(
      before?.parameters[PROCEDURAL_GENERATOR_BOX_CORNER_B],
    );
  });
});
