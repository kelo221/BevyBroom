import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandObjectsVisibilitySet } from '@/outliner/commands/command_objects_visibility_set.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';

/**
 * Creates a plain mesh with the given visibility.
 *
 * @param visible Starting visibility.
 * @returns New mesh.
 */
function meshCreate(visible: boolean): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  mesh.visible = visible;
  return mesh;
}

/** Unit tests for the undoable visibility change of several objects. */
describe('CommandObjectsVisibilitySet', () => {
  it('applies each requested visibility and restores the previous one on undo', () => {
    const shownMesh = meshCreate(true);
    const hiddenMesh = meshCreate(false);
    const command = new CommandObjectsVisibilitySet([
      { object: shownMesh, visible: false },
      { object: hiddenMesh, visible: true },
    ]);
    command.execute();
    expect([shownMesh.visible, hiddenMesh.visible]).toEqual([false, true]);
    command.undo();
    expect([shownMesh.visible, hiddenMesh.visible]).toEqual([true, false]);
  });

  it('reports how many objects it changes', () => {
    const changes = [meshCreate(true), meshCreate(true), meshCreate(true)].map((object) => ({
      object,
      visible: false,
    }));
    expect(new CommandObjectsVisibilitySet(changes).getChangedObjectCount()).toBe(changes.length);
  });

  it('applies the change only once when executed twice', () => {
    const mesh = meshCreate(true);
    const command = new CommandObjectsVisibilitySet([{ object: mesh, visible: false }]);
    command.execute();
    mesh.visible = true;
    command.execute();
    expect(mesh.visible).toBe(true);
  });

  it('takes hidden brushes out of evaluation and puts them back on undo', () => {
    const model = new SolidModel('VisibilitySetModel');
    model.addBoxBrush(4, SolidOperation.Additive);
    const cutter = model.addBoxBrush(2, SolidOperation.Subtractive);
    const cutterMesh = cutter.mesh;
    if (!cutterMesh) {
      throw new Error('cutter brush has no mesh');
    }
    const command = new CommandObjectsVisibilitySet([{ object: cutterMesh, visible: false }]);
    command.execute();
    expect(cutter.visible).toBe(false);
    command.undo();
    expect(cutter.visible).toBe(true);
  });
});
