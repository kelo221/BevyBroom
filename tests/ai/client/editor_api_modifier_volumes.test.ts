import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import { findMcpTool } from '@/ai/server/registry_mcp_tool.js';
import type { CommandStack } from '@/commands/command_stack.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { markAsSolidCsgGroup } from '@/solid/model/solid_group.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';
import type { ModifierStackSettings } from '@/modifier/stack/modifier_stack_types.js';
import { modifierStackKinds } from '@/modifier/stack/modifier_stack_catalog.js';
import { modifierVolumeTemplates } from '@/modifier/stack/modifier_volume_templates.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';
import { solidBrushToolsTestBoxAdd } from '../../tools/csg/solid/solid_brush_tools_test_helpers.js';

/** Edge length of the box the linear array copies. */
const SOURCE_BOX_EDGE = 1;

/** Gap between copies, on top of the box edge. */
const COPY_GAP = 1;

/** Copies a linear array call asks for, original included. */
const COPY_COUNT = 3;

/** API over one box brush, with everything a test needs to inspect it. */
interface ModifierApiRig {
  api: EditorApi;
  world: THREE.Group;
  model: SolidModel;
  brush: SolidBrushInstance;
  commandStack: CommandStack;
}

/**
 * Builds an editor API over one box brush at the world origin.
 *
 * @returns Rig.
 */
function modifierApiRigCreate(): ModifierApiRig {
  const parts = editorApiTestHostCreate();
  const model = new SolidModel('ModifierApi');
  parts.world.add(model.root);
  const edges = new THREE.Vector3(SOURCE_BOX_EDGE, SOURCE_BOX_EDGE, SOURCE_BOX_EDGE);
  const brush = solidBrushToolsTestBoxAdd(model, edges, new THREE.Vector3());
  model.rebuild(true);
  return { api: new EditorApi(parts.host), world: parts.world, model, brush, commandStack: parts.commandStack };
}

/**
 * Returns the arguments of a linear array volume that covers the rig's box and
 * all its copies along +X.
 *
 * @returns Tool arguments.
 */
function linearArrayArgs(): Record<string, unknown> {
  const step = SOURCE_BOX_EDGE + COPY_GAP;
  const span = step * COPY_COUNT;
  return {
    template: 'linear',
    center: { x: 0, y: 0, z: 0 },
    size: { x: span * 2, y: SOURCE_BOX_EDGE * 2, z: SOURCE_BOX_EDGE * 2 },
    modifiers: [{ kind: 'linear', parameters: { mode: 'fixed', offsetX: step, count: COPY_COUNT } }],
  };
}

/**
 * Returns the world X extent of a model's result mesh.
 *
 * @param model Solid model.
 * @returns Width along X.
 */
function resultWidth(model: SolidModel): number {
  model.rebuild();
  const mesh = model.getResultMesh();
  mesh.geometry.computeBoundingBox();
  const bounds = mesh.geometry.boundingBox ?? new THREE.Box3();
  return bounds.max.x - bounds.min.x;
}

/**
 * Reads the data of a successful tool result.
 *
 * @param result Tool result.
 * @returns Data payload.
 */
function okData<T>(result: { ok: boolean; message: string; data?: unknown }): T {
  expect(result.ok, result.message).toBe(true);
  return result.data as T;
}

/**
 * Creates the rig's linear array volume through the tool.
 *
 * @param rig Rig.
 * @returns Volume id and stack.
 */
function linearArrayAdd(rig: ModifierApiRig): { id: string; stack: ModifierStackSettings } {
  return okData<{ id: string; stack: ModifierStackSettings }>(
    rig.api.invokeTool('add_modifier_volume', linearArrayArgs()),
  );
}

describe('EditorApi modifier volumes', () => {
  it('lists the modifier volume tools in the MCP catalog', () => {
    for (const name of [
      'list_modifier_kinds',
      'add_modifier_volume',
      'get_modifier_stack',
      'set_modifier_stack',
      'bake_modifier_volume',
    ]) {
      expect(findMcpTool(name)).toBeDefined();
    }
  });

  it('lists every installed kind with JSON fields and every Add menu template', () => {
    const rig = modifierApiRigCreate();
    const data = okData<{ kinds: { id: string; fields: unknown[] }[]; templates: { id: string }[] }>(
      rig.api.invokeTool('list_modifier_kinds'),
    );
    expect(data.kinds.map((kind) => kind.id)).toEqual(modifierStackKinds.map((kind) => kind.id));
    expect(data.templates.map((template) => template.id)).toEqual(modifierVolumeTemplates.map((entry) => entry.id));
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it('adds a linear array volume as one undo step whose copies widen the result', () => {
    const rig = modifierApiRigCreate();
    const widthBefore = resultWidth(rig.model);
    const created = linearArrayAdd(rig);
    const volume = rig.world.getObjectByProperty('uuid', created.id);
    expect(volume && ModifierVolume.isVolume(volume)).toBe(true);
    expect(created.stack.modifiers.map((entry) => entry.kind)).toEqual(['linear']);
    const step = SOURCE_BOX_EDGE + COPY_GAP;
    expect(resultWidth(rig.model)).toBeCloseTo(widthBefore + step * (COPY_COUNT - 1), 5);
    expect(rig.commandStack.undo()).toBe(true);
    expect(rig.world.getObjectByProperty('uuid', created.id)).toBeUndefined();
    expect(resultWidth(rig.model)).toBeCloseTo(widthBefore, 5);
  });

  it('edits a step by id, keeping its other parameters, and rejects unknown kinds', () => {
    const rig = modifierApiRigCreate();
    const created = linearArrayAdd(rig);
    const stepId = created.stack.modifiers[0]?.id;
    const edited = okData<{ stack: ModifierStackSettings }>(
      rig.api.invokeTool('set_modifier_stack', {
        id: created.id,
        modifiers: [{ id: stepId, parameters: { count: COPY_COUNT + 1 } }, { kind: 'mirror' }],
      }),
    );
    expect(edited.stack.modifiers.map((entry) => entry.kind)).toEqual(['linear', 'mirror']);
    expect(edited.stack.modifiers[0]?.parameters['count']).toBe(COPY_COUNT + 1);
    expect(edited.stack.modifiers[0]?.parameters['offsetX']).toBe(SOURCE_BOX_EDGE + COPY_GAP);
    const unknown = rig.api.invokeTool('set_modifier_stack', { id: created.id, modifiers: [{ kind: 'nope' }] });
    expect(unknown.ok).toBe(false);
    expect(rig.api.invokeTool('get_modifier_stack', { id: 'missing' }).ok).toBe(false);
  });

  it('bakes a volume into brushes and undoes the bake', () => {
    const rig = modifierApiRigCreate();
    const created = linearArrayAdd(rig);
    const widthArrayed = resultWidth(rig.model);
    const baked = okData<{ createdBrushIds: string[] }>(rig.api.invokeTool('bake_modifier_volume', { id: created.id }));
    expect(baked.createdBrushIds).toHaveLength(COPY_COUNT - 1);
    expect(rig.world.getObjectByProperty('uuid', created.id)).toBeUndefined();
    expect(rig.model.getBrushes()).toHaveLength(COPY_COUNT);
    expect(resultWidth(rig.model)).toBeCloseTo(widthArrayed, 5);
    expect(rig.commandStack.undo()).toBe(true);
    expect(rig.model.getBrushes()).toHaveLength(1);
    expect(rig.world.getObjectByProperty('uuid', created.id)).toBeDefined();
  });
});

/**
 * Adds a volume under a parent through the tool.
 *
 * @param rig Rig.
 * @param parentId Parent id argument.
 * @returns Tool result.
 */
function volumeAddUnder(rig: ModifierApiRig, parentId: string): { ok: boolean; message: string; data?: unknown } {
  return rig.api.invokeTool('add_modifier_volume', { template: 'linear', parentId });
}

/**
 * Expects a tool call to fail without leaving an undo step.
 *
 * @param rig Rig.
 * @param result Tool result.
 */
function expectRefused(rig: ModifierApiRig, result: { ok: boolean; message: string }): void {
  expect(result.ok, result.message).toBe(false);
  expect(rig.commandStack.canUndo()).toBe(false);
}

describe('EditorApi modifier volume argument checks', () => {
  it('parents a volume under the world, a plain group, a solid model or a CSG group only', () => {
    const rig = modifierApiRigCreate();
    const plainGroup = new THREE.Group();
    rig.world.add(plainGroup);
    const csgGroup = new THREE.Group();
    markAsSolidCsgGroup(csgGroup, SolidOperation.Additive);
    rig.model.root.add(csgGroup);
    for (const parent of [plainGroup, rig.model.root, csgGroup]) {
      const created = okData<{ id: string }>(volumeAddUnder(rig, parent.uuid));
      expect(rig.world.getObjectByProperty('uuid', created.id)?.parent).toBe(parent);
    }
    const atWorld = okData<{ id: string }>(rig.api.invokeTool('add_modifier_volume', { template: 'linear' }));
    expect(rig.world.getObjectByProperty('uuid', atWorld.id)?.parent).toBe(rig.world);
  });

  it('refuses a brush, another volume or an unknown id as the parent', () => {
    const rig = modifierApiRigCreate();
    const volume = ModifierVolume.create({});
    rig.world.add(volume);
    const brushMesh = rig.brush.mesh;
    expect(brushMesh).toBeDefined();
    for (const parentId of [brushMesh?.uuid ?? '', volume.uuid, 'missing-object']) {
      expectRefused(rig, volumeAddUnder(rig, parentId));
    }
  });

  it('refuses a size with an edge that is not a positive number, and fills missing edges', () => {
    const rig = modifierApiRigCreate();
    for (const size of [{ x: 0 }, { y: -2 }, { z: 'wide' }, { x: Number.NaN }]) {
      expectRefused(rig, rig.api.invokeTool('add_modifier_volume', { template: 'linear', size }));
    }
    const edge = SOURCE_BOX_EDGE * 3;
    const created = okData<{ id: string }>(rig.api.invokeTool('add_modifier_volume', { size: { x: edge } }));
    const volume = rig.world.getObjectByProperty('uuid', created.id);
    if (!(volume instanceof THREE.Mesh)) throw new Error('Expected a volume mesh');
    const geometry = volume.geometry as THREE.BufferGeometry;
    geometry.computeBoundingBox();
    const size = (geometry.boundingBox ?? new THREE.Box3()).getSize(new THREE.Vector3());
    expect(size.toArray()).toEqual([edge, 1, 1]);
  });

  it('refuses excludedIds that are not a list of strings and parameters that are not an object', () => {
    const rig = modifierApiRigCreate();
    const created = linearArrayAdd(rig);
    const stackBefore = created.stack;
    for (const excludedIds of ['one-id', [1, 2], { id: 'x' }, null]) {
      expect(rig.api.invokeTool('set_modifier_stack', { id: created.id, excludedIds }).ok).toBe(false);
    }
    for (const parameters of [[1, 2], 'count=4', null]) {
      const modifiers = [{ kind: 'linear', parameters }];
      expect(rig.api.invokeTool('set_modifier_stack', { id: created.id, modifiers }).ok).toBe(false);
    }
    const volume = rig.world.getObjectByProperty('uuid', created.id);
    expect(volume ? ModifierVolume.read(volume) : null).toEqual(stackBefore);
  });
});
