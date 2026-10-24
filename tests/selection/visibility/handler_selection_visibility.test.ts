import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { HandlerSelectionVisibility } from '@/selection/visibility/handler_selection_visibility.js';

/** Scene, selection and handler a visibility test acts on. */
interface SelectionVisibilityFixture {
  worldObject: THREE.Object3D;
  group: THREE.Group;
  groupedMeshes: THREE.Mesh[];
  looseMeshes: THREE.Mesh[];
  selectionManager: ManagerSelection;
  commandStack: CommandStack;
  afterVisibilityChange: ReturnType<typeof vi.fn>;
  handler: HandlerSelectionVisibility;
}

/**
 * Creates a plain content mesh.
 *
 * @returns New mesh.
 */
function meshCreate(): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
}

/**
 * Builds a world holding a group of two meshes and two loose meshes.
 *
 * @returns World root, group and meshes.
 */
function worldCreate(): Pick<SelectionVisibilityFixture, 'worldObject' | 'group' | 'groupedMeshes' | 'looseMeshes'> {
  const worldObject = new THREE.Object3D();
  const group = new THREE.Group();
  const groupedMeshes = [meshCreate(), meshCreate()];
  const looseMeshes = [meshCreate(), meshCreate()];
  group.add(...groupedMeshes);
  worldObject.add(group, ...looseMeshes);
  return { worldObject, group, groupedMeshes, looseMeshes };
}

/**
 * Builds the world, an empty selection and the handler over them.
 *
 * @returns Fixture with an empty selection.
 */
function fixtureCreate(): SelectionVisibilityFixture {
  const world = worldCreate();
  const selectionManager = new ManagerSelection();
  const commandStack = new CommandStack(16);
  const afterVisibilityChange = vi.fn();
  const handler = new HandlerSelectionVisibility({
    commandStack,
    selectionManager,
    worldObject: world.worldObject,
    afterVisibilityChange,
  });
  return { ...world, selectionManager, commandStack, afterVisibilityChange, handler };
}

/**
 * Lists the visibility of every content mesh of the fixture.
 *
 * @param fixture Visibility fixture.
 * @returns Visibility flags, grouped meshes first.
 */
function visibilityList(fixture: SelectionVisibilityFixture): boolean[] {
  return [...fixture.groupedMeshes, ...fixture.looseMeshes].map((mesh) => mesh.visible);
}

/** Unit tests for Hide Selected, Isolate Selected and Show All. */
describe('HandlerSelectionVisibility', () => {
  it('hides the selected objects, clears the selection and undoes as one step', () => {
    const fixture = fixtureCreate();
    const [firstLoose] = fixture.looseMeshes;
    fixture.selectionManager.setSelection([...fixture.groupedMeshes]);
    expect(fixture.handler.hideSelected()).toBe(fixture.groupedMeshes.length);
    expect(fixture.groupedMeshes.every((mesh) => !mesh.visible)).toBe(true);
    expect(firstLoose?.visible).toBe(true);
    expect(fixture.selectionManager.getSelectedObjectCount()).toBe(0);
    expect(fixture.afterVisibilityChange).toHaveBeenCalledOnce();
    fixture.commandStack.undo();
    expect(visibilityList(fixture).every((visible) => visible)).toBe(true);
  });

  it('isolates the selection by hiding every other visible object', () => {
    const fixture = fixtureCreate();
    const [kept, ...others] = [...fixture.looseMeshes, ...fixture.groupedMeshes];
    if (!kept) {
      throw new Error('fixture has no meshes');
    }
    fixture.selectionManager.setSelection([kept]);
    expect(fixture.handler.isolateSelected()).toBe(others.length);
    expect(kept.visible).toBe(true);
    expect(others.every((mesh) => !mesh.visible)).toBe(true);
    expect(fixture.selectionManager.getSelectedObjectCount()).toBe(1);
  });

  it('keeps children of a selected mesh visible when isolating', () => {
    const fixture = fixtureCreate();
    const [parentMesh, otherMesh] = fixture.looseMeshes;
    if (!parentMesh || !otherMesh) {
      throw new Error('fixture has too few loose meshes');
    }
    const childMesh = meshCreate();
    parentMesh.add(childMesh);
    fixture.selectionManager.setSelection([parentMesh]);
    fixture.handler.isolateSelected();
    expect(childMesh.visible).toBe(true);
    expect(otherMesh.visible).toBe(false);
  });

  it('does nothing and pushes no undo step without a selection or hidden objects', () => {
    const fixture = fixtureCreate();
    expect(fixture.handler.hideSelected()).toBe(0);
    expect(fixture.handler.isolateSelected()).toBe(0);
    expect(fixture.handler.showAll()).toBe(0);
    expect(fixture.commandStack.canUndo()).toBe(false);
    expect(fixture.afterVisibilityChange).not.toHaveBeenCalled();
  });

  it('shows every hidden object together with its hidden parent group', () => {
    const fixture = fixtureCreate();
    const [hiddenLoose] = fixture.looseMeshes;
    const [hiddenGrouped] = fixture.groupedMeshes;
    if (!hiddenLoose || !hiddenGrouped) {
      throw new Error('fixture has no meshes');
    }
    hiddenLoose.visible = false;
    hiddenGrouped.visible = false;
    fixture.group.visible = false;
    expect(fixture.handler.showAll()).toBe(3);
    expect(fixture.group.visible).toBe(true);
    expect(visibilityList(fixture).every((visible) => visible)).toBe(true);
    fixture.commandStack.undo();
    expect([fixture.group.visible, hiddenLoose.visible, hiddenGrouped.visible]).toEqual([false, false, false]);
  });
});
