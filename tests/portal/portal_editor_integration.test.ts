import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { entityKindRead } from '@/entity/model/entity_owner_keys.js';
import { FactoryObjectIcon } from '@/outliner/ui/factory_object_icon.js';
import { HandlerObjectAction } from '@/outliner/hierarchy/handler_object_action.js';
import { getOutlinerContentChildren } from '@/outliner/ui/outliner_tree_hierarchy.js';
import { PortalOwner } from '@/portal/model/portal_owner.js';
import { RoomOwner } from '@/portal/model/room_owner.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { resolveTransformTargets } from '@/selection/object/resolve_transform_targets.js';
import { HandlerPrimitiveCreation } from '@/tools/creation/handler_primitive_creation.js';
import { ToolPrimitiveCreation } from '@/tools/creation/tool_primitive_creation.js';

/** Editor pieces wired together the way the layout wires them. */
interface PortalEditorRig {
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
function createRig(): PortalEditorRig {
  const world = new THREE.Group();
  const stack = new CommandStack(16);
  const selection = new ManagerSelection();
  const creation = new HandlerPrimitiveCreation(new ToolPrimitiveCreation(world), world, stack, selection);
  creation.setActiveCameraProvider(() => null);
  const actions = new HandlerObjectAction(world, stack, selection);
  return { world, stack, selection, creation, actions };
}

/**
 * Returns the world children of one entity kind.
 *
 * @param world World root.
 * @param kind Entity kind.
 * @returns Matching owners.
 */
function worldEntities(world: THREE.Group, kind: 'room' | 'portal'): THREE.Object3D[] {
  return world.children.filter((child) => entityKindRead(child) === kind);
}

/** Rooms and portals created from the Add menu behave like other scene objects. */
describe('room and portal editor integration', () => {
  it('creates a selected room and a selected portal whose markers move their owners', () => {
    const rig = createRig();
    rig.creation.createRoom();
    const [room] = worldEntities(rig.world, 'room');
    expect(rig.selection.getInspectorObjects()).toEqual([room]);
    rig.creation.createPortal();
    const [portal] = worldEntities(rig.world, 'portal');
    expect(portal ? PortalOwner.settingsRead(portal) : null).not.toBeNull();
    expect(resolveTransformTargets(rig.selection.getAllSelectedObjectsAsArray())).toEqual([portal]);
    rig.stack.undo();
    expect(worldEntities(rig.world, 'portal')).toHaveLength(0);
    expect(worldEntities(rig.world, 'room')).toHaveLength(1);
  });

  it('duplicates a portal with its settings and deletes it whole through its marker', () => {
    const rig = createRig();
    rig.creation.createPortal();
    const [portal] = worldEntities(rig.world, 'portal');
    if (!portal) throw new Error('missing portal');
    PortalOwner.settingsWrite(portal, { width: 2, height: 3, closed: true });
    rig.actions.onDuplicateSelected();
    const portals = worldEntities(rig.world, 'portal');
    expect(portals).toHaveLength(2);
    expect(PortalOwner.settingsRead(portals[1] ?? portal)).toEqual(PortalOwner.settingsRead(portal));
    rig.actions.onDeleteSelected();
    expect(worldEntities(rig.world, 'portal')).toEqual([portal]);
  });

  it('shows rooms and portals as single outliner rows with their own icons', () => {
    const rig = createRig();
    rig.creation.createRoom();
    rig.creation.createPortal();
    const [room] = worldEntities(rig.world, 'room');
    const [portal] = worldEntities(rig.world, 'portal');
    if (!room || !portal) throw new Error('missing entity');
    expect(getOutlinerContentChildren(room)).toHaveLength(0);
    expect(getOutlinerContentChildren(portal)).toHaveLength(0);
    const groupIcon = FactoryObjectIcon.getIcon(new THREE.Group());
    expect(FactoryObjectIcon.getIcon(room)).not.toEqual(groupIcon);
    expect(FactoryObjectIcon.getIcon(portal)).not.toEqual(FactoryObjectIcon.getIcon(room));
    expect(RoomOwner.markerOf(room)).not.toBeNull();
  });
});
