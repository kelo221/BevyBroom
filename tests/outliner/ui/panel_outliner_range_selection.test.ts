import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { PanelOutliner } from '@/outliner/ui/panel_outliner.js';

/** Modifier keys held during a row click. */
interface RowClickModifiers {
  readonly shiftKey?: boolean;
  readonly ctrlKey?: boolean;
}

/**
 * Creates mesh rows under a root.
 *
 * @param root Scene root shown by the outliner.
 * @param rowCount Number of meshes.
 * @returns Meshes in the order they were added.
 */
function rowMeshesAdd(root: THREE.Object3D, rowCount: number): THREE.Mesh[] {
  return Array.from({ length: rowCount }, (_, index) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    mesh.name = `RangeRow${index}`;
    root.add(mesh);
    return mesh;
  });
}

/**
 * Finds the shown row element of an object by its name.
 *
 * @param container Outliner host.
 * @param name Object name.
 * @returns Row element.
 */
function rowElementFind(container: HTMLElement, name: string): HTMLElement {
  const rows = Array.from(container.querySelectorAll<HTMLElement>('.editor-outliner-row'));
  const row = rows.find((candidate) => candidate.style.display !== 'none' && candidate.textContent?.includes(name));
  if (!row) throw new Error(`row ${name} not shown`);
  return row;
}

/**
 * Presses and clicks a row with modifier keys held.
 *
 * @param container Outliner host.
 * @param mesh Object of the row.
 * @param modifiers Held modifier keys.
 * @returns The press event, to check whether it was prevented.
 */
function rowClick(container: HTMLElement, mesh: THREE.Object3D, modifiers: RowClickModifiers = {}): MouseEvent {
  const row = rowElementFind(container, mesh.name);
  const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true, ...modifiers });
  row.dispatchEvent(press);
  row.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, ...modifiers }));
  return press;
}

/**
 * Shift+click on an outliner row selects every row between the last plain click
 * and the clicked row, up or down; Ctrl+click toggles one row.
 */
describe('PanelOutliner range selection', () => {
  let container: HTMLElement;
  let selectionManager: ManagerSelection;
  let root: THREE.Group;
  let panel: PanelOutliner;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    selectionManager = new ManagerSelection();
    root = new THREE.Group();
    panel = new PanelOutliner(container, selectionManager, root);
  });

  afterEach(() => {
    panel.dispose();
    selectionManager.dispose();
    container.remove();
  });

  it('selects every row from the clicked row down to the Shift+clicked row', () => {
    const meshes = rowMeshesAdd(root, 6);
    panel.refresh();
    rowClick(container, meshes[1] ?? root);
    rowClick(container, meshes[4] ?? root, { shiftKey: true });
    expect(panel.getObjectsForGrouping()).toEqual(meshes.slice(1, 5));
  });

  it('selects every row from the clicked row up to the Shift+clicked row', () => {
    const meshes = rowMeshesAdd(root, 6);
    panel.refresh();
    rowClick(container, meshes[4] ?? root);
    rowClick(container, meshes[1] ?? root, { shiftKey: true });
    expect(new Set(panel.getObjectsForGrouping())).toEqual(new Set(meshes.slice(1, 5)));
  });

  it('keeps the first clicked row as anchor across several Shift+clicks', () => {
    const meshes = rowMeshesAdd(root, 6);
    panel.refresh();
    rowClick(container, meshes[2] ?? root);
    rowClick(container, meshes[5] ?? root, { shiftKey: true });
    rowClick(container, meshes[0] ?? root, { shiftKey: true });
    expect(new Set(panel.getObjectsForGrouping())).toEqual(new Set(meshes.slice(0, 3)));
  });

  it('toggles one row with Ctrl+click and ranges from it afterwards', () => {
    const meshes = rowMeshesAdd(root, 6);
    panel.refresh();
    rowClick(container, meshes[0] ?? root);
    rowClick(container, meshes[3] ?? root, { ctrlKey: true });
    expect(new Set(panel.getObjectsForGrouping())).toEqual(new Set([meshes[0], meshes[3]]));
    rowClick(container, meshes[3] ?? root, { ctrlKey: true });
    expect(panel.getObjectsForGrouping()).toEqual([meshes[0]]);
    rowClick(container, meshes[5] ?? root, { shiftKey: true });
    expect(new Set(panel.getObjectsForGrouping())).toEqual(new Set(meshes.slice(3, 6)));
  });

  it('keeps a Shift press from selecting page text', () => {
    const meshes = rowMeshesAdd(root, 3);
    panel.refresh();
    rowClick(container, meshes[0] ?? root);
    document.getSelection()?.selectAllChildren(container);
    const press = rowClick(container, meshes[2] ?? root, { shiftKey: true });
    expect(press.defaultPrevented).toBe(true);
    expect(document.getSelection()?.toString()).toBe('');
  });
});
