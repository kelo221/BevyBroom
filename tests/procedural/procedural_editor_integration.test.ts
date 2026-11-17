import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { EntityHandleDragSession } from '@/entity/handles/entity_handle_drag_session.js';
import { entityHandleTargetsOfOwner } from '@/entity/handles/entity_handle_targets.js';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import { HandlerObjectAction } from '@/outliner/hierarchy/handler_object_action.js';
import { PROCEDURAL_GENERATOR_BOX_CORNER_B } from '@/procedural/generator/box/procedural_generator_box.js';
import { ProceduralParametersRead } from '@/procedural/generator/procedural_parameters_read.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import { ProceduralVisualBuilder } from '@/procedural/visual/procedural_visual_builder.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { entityHandleTestRayToward, entityHandleTestViewsCreate } from '../entity/handles/entity_handle_test_views.js';

/**
 * Returns the world position of a box's corner B.
 *
 * @param owner Box owner with a current world matrix.
 * @returns World corner.
 */
function cornerBWorld(owner: THREE.Object3D): THREE.Vector3 {
  const settings = ProceduralOwner.settingsRead(owner);
  const local = settings
    ? ProceduralParametersRead.vector3(settings.parameters, PROCEDURAL_GENERATOR_BOX_CORNER_B)
    : null;
  if (local === null) throw new Error('missing settings');
  return owner.localToWorld(local);
}

/**
 * Creates a world with a box placed away from the origin.
 *
 * @returns World and box.
 */
function worldWithBox(): { world: THREE.Group; owner: THREE.Group } {
  const world = new THREE.Group();
  const owner = ProceduralOwner.createDefault('Crate');
  owner.position.set(2, 0, -1);
  world.add(owner);
  world.updateMatrixWorld(true);
  return { world, owner };
}

/**
 * A procedural box behaves like any editor object: drag, undo, save, load,
 * duplicate.
 */
describe('procedural box editor integration', () => {
  it('drags a corner handle onto the grid as one undo step that rebuilds the mesh', () => {
    const { owner } = worldWithBox();
    const stack = new CommandStack(16);
    const snap = new GridSnap(true, 0.25);
    const session = new EntityHandleDragSession(stack, snap);
    const target = entityHandleTargetsOfOwner(owner).find(
      (candidate) => candidate.handle.handleName === PROCEDURAL_GENERATOR_BOX_CORNER_B,
    );
    const start = cornerBWorld(owner);
    const camera = entityHandleTestViewsCreate(start)[0]?.camera;
    if (!target || !camera) throw new Error('missing handle or camera');
    const sizeBefore = ProceduralVisualBuilder.meshFind(owner)?.geometry.boundingBox?.clone();
    session.begin(target, camera, entityHandleTestRayToward(camera, start));
    session.move(entityHandleTestRayToward(camera, start.clone().add(new THREE.Vector3(1.37, 0, 0.61))));
    session.end();
    const moved = cornerBWorld(owner);
    expect(moved.x).toBeCloseTo(snap.snapValue(start.x + 1.37), 6);
    expect(moved.z).toBeCloseTo(snap.snapValue(start.z + 0.61), 6);
    expect(ProceduralVisualBuilder.meshFind(owner)?.geometry.boundingBox?.equals(sizeBefore ?? new THREE.Box3())).toBe(
      false,
    );
    stack.undo();
    expect(cornerBWorld(owner).distanceTo(start)).toBeLessThan(1e-9);
    expect(stack.canUndo()).toBe(false);
  });

  it('saves and loads its parameters, textures and id, and rebuilds its mesh', () => {
    const { world, owner } = worldWithBox();
    const settings = ProceduralOwner.settingsRead(owner);
    if (settings === null) throw new Error('missing settings');
    ProceduralOwner.settingsWrite(owner, {
      ...settings,
      parameters: { ...settings.parameters, [PROCEDURAL_GENERATOR_BOX_CORNER_B]: [3, 2.5, 1.25] },
      materials: Object.fromEntries(Object.keys(settings.materials).map((slot) => [slot, 'metal/plate'])),
    });
    const loaded = new THREE.Group();
    new SceneDeserializer().deserialize(JSON.parse(JSON.stringify(new SceneSerializer().serialize(world))), loaded);
    const copy = loaded.getObjectByProperty('uuid', owner.uuid);
    if (!copy) throw new Error('the box was not loaded');
    expect(ProceduralOwner.settingsRead(copy)).toEqual(ProceduralOwner.settingsRead(owner));
    expect(copy.position.toArray()).toEqual(owner.position.toArray());
    const loadedMesh = ProceduralVisualBuilder.meshFind(copy);
    const liveMesh = ProceduralVisualBuilder.meshFind(owner);
    loadedMesh?.geometry.computeBoundingBox();
    liveMesh?.geometry.computeBoundingBox();
    expect(loadedMesh?.geometry.boundingBox?.equals(liveMesh?.geometry.boundingBox ?? new THREE.Box3())).toBe(true);
  });

  it('duplicates with its own copy of the parameters', () => {
    const { world, owner } = worldWithBox();
    const stack = new CommandStack(16);
    const selection = new ManagerSelection();
    const marker = ProceduralOwner.markerOf(owner);
    if (!marker) throw new Error('missing marker');
    selection.selectObject(marker);
    new HandlerObjectAction(world, stack, selection).onDuplicateSelected();
    const owners = ProceduralOwner.collectUnder(world);
    expect(owners).toHaveLength(2);
    const duplicate = owners.find((candidate) => candidate !== owner);
    if (!duplicate) throw new Error('missing duplicate');
    expect(ProceduralOwner.settingsRead(duplicate)).toEqual(ProceduralOwner.settingsRead(owner));
    expect(ProceduralVisualBuilder.meshFind(duplicate)).not.toBe(ProceduralVisualBuilder.meshFind(owner));
  });
});
