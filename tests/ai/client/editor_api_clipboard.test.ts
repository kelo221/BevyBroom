import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import { findMcpTool } from '@/ai/server/registry_mcp_tool.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { selectionMeshesFromHierarchyCollect } from '@/selection/object/selection_hierarchy_meshes.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from './editor_api_test_host.js';

/**
 * Selects hierarchy objects in the host selection.
 *
 * @param parts Test host parts.
 * @param objects Objects to select.
 */
function objectsSelect(parts: EditorApiTestHostParts, objects: THREE.Object3D[]): void {
  parts.host.selectionManager.setSelection(selectionMeshesFromHierarchyCollect(objects), objects);
}

/**
 * Adds a selected light to the test world.
 *
 * @param parts Test host parts.
 * @returns The light.
 */
function selectedLightAdd(parts: EditorApiTestHostParts): THREE.Object3D {
  const light = LightOwner.create('Lamp', lightSettingsCreateDefault('point'));
  light.position.set(3, 2, -1);
  parts.world.add(light);
  objectsSelect(parts, [light]);
  return light;
}

/**
 * Counts the lights directly under the world.
 *
 * @param world World root.
 * @returns Light count.
 */
function lightCountRead(world: THREE.Object3D): number {
  return world.children.filter((child) => LightOwner.settingsRead(child) !== null).length;
}

/** Unit tests for the copy_selection and paste_objects MCP tools. */
describe('EditorApi clipboard tools', () => {
  it('lists both tools in the MCP catalog', () => {
    expect(findMcpTool('copy_selection')).toBeDefined();
    expect(findMcpTool('paste_objects')).toBeDefined();
  });

  it('copies the selection as text and pastes it back as one undo step with new ids', () => {
    const parts = editorApiTestHostCreate();
    const api = new EditorApi(parts.host);
    const light = selectedLightAdd(parts);
    const copied = api.invokeTool('copy_selection');
    expect(copied.ok).toBe(true);
    const copiedData = copied.data as { text: string; count: number };
    expect(copiedData.count).toBe(1);
    const pasted = api.invokeTool('paste_objects', { text: copiedData.text, atOriginalPosition: true });
    expect(pasted.ok).toBe(true);
    const pastedIds = (pasted.data as { ids: string[] }).ids;
    expect(pastedIds).toHaveLength(1);
    expect(pastedIds[0]).not.toBe(light.uuid);
    const pastedLight = parts.world.getObjectByProperty('uuid', pastedIds[0] ?? '');
    expect(pastedLight?.position.distanceTo(light.position)).toBeLessThan(1e-6);
    parts.commandStack.undo();
    expect(lightCountRead(parts.world)).toBe(1);
  });

  it('pastes the text copied last when no text is given', () => {
    const parts = editorApiTestHostCreate();
    const api = new EditorApi(parts.host);
    selectedLightAdd(parts);
    api.invokeTool('copy_selection');
    expect(api.invokeTool('paste_objects').ok).toBe(true);
    expect(lightCountRead(parts.world)).toBe(2);
  });

  it('reports brush ids for pasted brushes', () => {
    const parts = editorApiTestHostCreate();
    const api = new EditorApi(parts.host);
    const model = new SolidModel('Level');
    parts.world.add(model.root);
    const brush = model.addBoxBrush(2, SolidOperation.Additive, null, true);
    objectsSelect(parts, brush.mesh === null ? [] : [brush.mesh]);
    const text = (api.invokeTool('copy_selection').data as { text: string }).text;
    const pastedIds = (api.invokeTool('paste_objects', { text, atOriginalPosition: true }).data as { ids: string[] })
      .ids;
    expect(pastedIds).toHaveLength(1);
    expect(pastedIds[0]).not.toBe(brush.id);
    expect(model.findBrush(pastedIds[0] ?? '')).toBeDefined();
  });

  it('rejects text that holds no editor objects, bad arguments and an empty selection', () => {
    const parts = editorApiTestHostCreate();
    const api = new EditorApi(parts.host);
    expect(api.invokeTool('copy_selection').ok).toBe(false);
    expect(api.invokeTool('paste_objects', { text: 'not a level' }).ok).toBe(false);
    expect(api.invokeTool('paste_objects', { text: 42 }).ok).toBe(false);
    expect(api.invokeTool('paste_objects', { text: '{}', atOriginalPosition: 'yes' }).ok).toBe(false);
    expect(parts.commandStack.canUndo()).toBe(false);
  });
});
