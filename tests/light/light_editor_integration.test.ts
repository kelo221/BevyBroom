import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { HandlerPrimitiveCreation } from '@/tools/creation/handler_primitive_creation.js';
import { ToolPrimitiveCreation } from '@/tools/creation/tool_primitive_creation.js';
import { HandlerObjectAction } from '@/outliner/hierarchy/handler_object_action.js';
import { resolveTransformTargets } from '@/selection/object/resolve_transform_targets.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { isLightOwner } from '@/light/model/light_owner_keys.js';
import { FactoryObjectIcon } from '@/outliner/ui/factory_object_icon.js';
import { getOutlinerContentChildren } from '@/outliner/ui/outliner_tree_hierarchy.js';

/** Editor pieces wired together the way the layout wires them. */
interface LightEditorRig {
  world: THREE.Group;
  stack: CommandStack;
  selection: ManagerSelection;
  creation: HandlerPrimitiveCreation;
  actions: HandlerObjectAction;
}

/**
 * Builds a world with creation, selection and object actions.
 *
 * @returns The rig.
 */
function createRig(): LightEditorRig {
  const world = new THREE.Group();
  const stack = new CommandStack(16);
  const selection = new ManagerSelection();
  const creation = new HandlerPrimitiveCreation(new ToolPrimitiveCreation(world), world, stack, selection);
  creation.setActiveCameraProvider(() => null);
  const actions = new HandlerObjectAction(world, stack, selection);
  return { world, stack, selection, creation, actions };
}

/**
 * Returns the light owners directly under the world.
 *
 * @param world World root.
 * @returns Light owners.
 */
function worldLights(world: THREE.Group): THREE.Object3D[] {
  return world.children.filter((child) => isLightOwner(child));
}

/** Lights created from the Add menu behave like other scene objects. */
describe('light editor integration', () => {
  it('creates a selected spot light whose marker moves the light owner', () => {
    const rig = createRig();
    rig.creation.createSpotLight();
    const [light] = worldLights(rig.world);
    expect(light).toBeDefined();
    if (!light) return;
    expect(LightOwner.settingsRead(light)?.kind).toBe('spot');
    expect(rig.selection.getInspectorObjects()).toEqual([light]);
    const targets = resolveTransformTargets(rig.selection.getAllSelectedObjectsAsArray());
    expect(targets).toEqual([light]);
    rig.stack.undo();
    expect(worldLights(rig.world)).toHaveLength(0);
  });

  it('duplicates the selected light and undoes the duplicate', () => {
    const rig = createRig();
    rig.creation.createPointLight();
    rig.actions.onDuplicateSelected();
    expect(worldLights(rig.world)).toHaveLength(2);
    rig.stack.undo();
    expect(worldLights(rig.world)).toHaveLength(1);
  });

  it('deletes the whole light when its marker is selected and restores it on undo', () => {
    const rig = createRig();
    rig.creation.createPointLight();
    const [light] = worldLights(rig.world);
    rig.actions.onDeleteSelected();
    expect(worldLights(rig.world)).toHaveLength(0);
    rig.stack.undo();
    expect(worldLights(rig.world)).toEqual([light]);
    expect(light ? LightOwner.markerOf(light) : null).not.toBeNull();
  });

  it('shows a light as one outliner row with a light icon', () => {
    const rig = createRig();
    rig.creation.createSpotLight();
    const [light] = worldLights(rig.world);
    if (!light) throw new Error('missing light');
    expect(getOutlinerContentChildren(light)).toHaveLength(0);
    expect(FactoryObjectIcon.getIcon(light)).not.toEqual(FactoryObjectIcon.getIcon(new THREE.Group()));
  });
});
