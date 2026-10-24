import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { selectionQueriesList, selectionQueryFind } from '@/selection/query/selection_query_registry.js';
import { selectionQueryRun } from '@/selection/query/selection_query_run.js';
import type { SelectionQueryId } from '@/selection/query/selection_query.js';
import { solidBrushToolsTestBoxAdd } from '../../tools/csg/solid/solid_brush_tools_test_helpers.js';

/** Scene with brushes placed relative to one anchor box. */
interface SelectionQueryTestScene {
  readonly world: THREE.Group;
  readonly anchor: SolidBrushInstance;
  readonly touching: SolidBrushInstance;
  readonly inside: SolidBrushInstance;
  readonly above: SolidBrushInstance;
  readonly far: SolidBrushInstance;
}

/**
 * Builds a world with an anchor box and brushes touching it, inside it, above
 * it and far from it, all derived from the anchor size.
 *
 * @returns Scene parts.
 */
function selectionQueryTestSceneCreate(): SelectionQueryTestScene {
  const world = new THREE.Group();
  const model = new SolidModel('SelectionQuery');
  world.add(model.root);
  const edge = 4;
  const anchor = solidBrushToolsTestBoxAdd(model, new THREE.Vector3(edge, edge, edge), new THREE.Vector3());
  const touching = solidBrushToolsTestBoxAdd(
    model,
    new THREE.Vector3(1, 1, 1),
    new THREE.Vector3(edge / 2 + 0.5, 0, 0),
  );
  const inside = solidBrushToolsTestBoxAdd(model, new THREE.Vector3(1, 1, 1), new THREE.Vector3(0.5, 0.5, 0.5));
  const above = solidBrushToolsTestBoxAdd(model, new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, edge * 3, 0));
  const far = solidBrushToolsTestBoxAdd(model, new THREE.Vector3(1, 1, 1), new THREE.Vector3(edge * 5, 0, edge * 5));
  world.updateMatrixWorld(true);
  return { world, anchor, touching, inside, above, far };
}

/**
 * Selects one brush, runs a query and returns the selected brush ids.
 *
 * @param scene Test scene.
 * @param selectedBrush Brush selected before the query.
 * @param queryId Query to run.
 * @returns Selected brush ids after the query, sorted.
 */
function selectionQueryTestRun(
  scene: SelectionQueryTestScene,
  selectedBrush: SolidBrushInstance,
  queryId: SelectionQueryId,
): string[] {
  const selection = new ManagerSelection();
  if (selectedBrush.mesh) selection.setSelection([selectedBrush.mesh]);
  const query = selectionQueryFind(queryId);
  if (!query) throw new Error(`query ${queryId} missing`);
  selectionQueryRun(query, selection, scene.world);
  return selection
    .getAllSelectedObjectsAsArray()
    .map((mesh) => SolidModel.fromObject(mesh)?.findBrushByMesh(mesh)?.id ?? '')
    .sort();
}

/**
 * Returns sorted brush ids.
 *
 * @param brushes Brushes.
 * @returns Sorted ids.
 */
function selectionQueryTestIds(...brushes: SolidBrushInstance[]): string[] {
  return brushes.map((brush) => brush.id).sort();
}

describe('selection queries', () => {
  it('lists six queries with unique ids and labels', () => {
    const queries = selectionQueriesList();
    expect(queries).toHaveLength(6);
    expect(new Set(queries.map((query) => query.id)).size).toBe(queries.length);
    expect(new Set(queries.map((query) => query.label)).size).toBe(queries.length);
  });

  it('inverts the selection', () => {
    const scene = selectionQueryTestSceneCreate();
    const { anchor, touching, inside, above, far } = scene;
    expect(selectionQueryTestRun(scene, anchor, 'inverse')).toEqual(
      selectionQueryTestIds(touching, inside, above, far),
    );
  });

  it('selects brushes touching or overlapping the selection', () => {
    const scene = selectionQueryTestSceneCreate();
    expect(selectionQueryTestRun(scene, scene.anchor, 'touching')).toEqual(
      selectionQueryTestIds(scene.touching, scene.inside),
    );
  });

  it('selects brushes fully inside the selection', () => {
    const scene = selectionQueryTestSceneCreate();
    expect(selectionQueryTestRun(scene, scene.anchor, 'inside')).toEqual(selectionQueryTestIds(scene.inside));
  });

  it('selects brushes inside the selection footprint at any height', () => {
    const scene = selectionQueryTestSceneCreate();
    expect(selectionQueryTestRun(scene, scene.anchor, 'tall')).toEqual(
      selectionQueryTestIds(scene.inside, scene.above),
    );
  });

  it('selects the brushes sharing a parent with the selection', () => {
    const scene = selectionQueryTestSceneCreate();
    const { anchor, touching, inside, above, far } = scene;
    expect(selectionQueryTestRun(scene, far, 'siblings')).toEqual(
      selectionQueryTestIds(anchor, touching, inside, above, far),
    );
  });

  it('selects brushes that use a texture of the selection', () => {
    const scene = selectionQueryTestSceneCreate();
    scene.far.setFaceTextureId(0, 'query-texture');
    scene.inside.setFaceTextureId(2, 'query-texture');
    expect(selectionQueryTestRun(scene, scene.far, 'by_material')).toContain(scene.inside.id);
    scene.above.setAllFacesTextureId('query-other-texture');
    expect(selectionQueryTestRun(scene, scene.far, 'by_material')).not.toContain(scene.above.id);
  });

  it('leaves the selection empty when a query needs one and nothing is selected', () => {
    const scene = selectionQueryTestSceneCreate();
    const selection = new ManagerSelection();
    const touchingQuery = selectionQueryFind('touching');
    if (!touchingQuery) throw new Error('touching query missing');
    expect(selectionQueryRun(touchingQuery, selection, scene.world)).toBe(0);
    expect(selection.getSelectedObjectCount()).toBe(0);
  });
});
