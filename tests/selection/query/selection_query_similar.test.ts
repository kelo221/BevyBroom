import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LightOwner } from '@/light/model/light_owner.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { getStateSelectionFilter } from '@/selection/filter/state_selection_filter.js';
import { selectionQueryFind } from '@/selection/query/selection_query_registry.js';
import { selectionQueryRun } from '@/selection/query/selection_query_run.js';
import { SelectionFilterMode } from '@/types/selection_filter_mode.js';
import { hierarchyNameAllocator } from '@/utils/utils_hierarchy_name_allocator.js';

/** Scene with lamp fixture copies and look-alikes that must not match. */
interface SelectionQuerySimilarScene {
  readonly world: THREE.Group;
  readonly fixtures: THREE.Group[];
  readonly fixtureWithoutLight: THREE.Group;
  readonly otherNamedFixture: THREE.Group;
  readonly looseLight: THREE.Group;
}

/**
 * Creates a fixture group holding a fixture mesh and one light, named like a
 * copy of the given name.
 *
 * @param nameBase Name the copy suffix is added to.
 * @param withLight True to put a light into the fixture.
 * @returns Fixture group.
 */
function fixtureCreate(nameBase: string, withLight: boolean): THREE.Group {
  const fixture = new THREE.Group();
  fixture.name = hierarchyNameAllocator.allocate(nameBase);
  fixture.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  if (withLight) {
    fixture.add(LightOwner.createDefault(hierarchyNameAllocator.allocate('Lamp'), 'point'));
  }
  return fixture;
}

/**
 * Builds a world with several lamp fixtures, a fixture without a light, a
 * differently named fixture and a light outside any fixture.
 *
 * @param fixtureCount Number of lamp fixtures.
 * @returns Scene parts.
 */
function selectionQuerySimilarSceneCreate(fixtureCount: number): SelectionQuerySimilarScene {
  const world = new THREE.Group();
  const fixtures = Array.from({ length: fixtureCount }, () => fixtureCreate('LampFixture', true));
  const fixtureWithoutLight = fixtureCreate('LampFixture', false);
  const otherNamedFixture = fixtureCreate('WallSconce', true);
  const looseLight = LightOwner.createDefault(hierarchyNameAllocator.allocate('Lamp'), 'point');
  world.add(...fixtures, fixtureWithoutLight, otherNamedFixture, looseLight);
  world.updateMatrixWorld(true);
  return { world, fixtures, fixtureWithoutLight, otherNamedFixture, looseLight };
}

/**
 * Selects one object's clickable mesh, runs the Similar query and returns the
 * objects the inspector then edits.
 *
 * @param world Scene root.
 * @param startMesh Mesh selected before the query.
 * @returns Inspector objects after the query.
 */
function similarRun(world: THREE.Object3D, startMesh: THREE.Mesh): THREE.Object3D[] {
  const selection = new ManagerSelection();
  selection.setSelection([startMesh]);
  const query = selectionQueryFind('similar');
  if (!query) throw new Error('similar query missing');
  selectionQueryRun(query, selection, world);
  return selection.getInspectorObjects();
}

/**
 * Returns the fixture mesh of a fixture group.
 *
 * @param fixture Fixture group.
 * @returns First mesh child.
 */
function fixtureMeshRead(fixture: THREE.Group): THREE.Mesh {
  const mesh = fixture.children.find((child): child is THREE.Mesh => child instanceof THREE.Mesh);
  if (!mesh) throw new Error('fixture without mesh');
  return mesh;
}

/**
 * Select Similar picks every copy of the selected object from one click,
 * compared at the level the selection filter picks.
 */
describe('Select Similar query', () => {
  afterEach(() => getStateSelectionFilter().reset());

  it('selects every copy of a fixture group in Groups mode and nothing else', () => {
    getStateSelectionFilter().modeWrite(SelectionFilterMode.GROUPS);
    const scene = selectionQuerySimilarSceneCreate(5);
    const firstFixture = scene.fixtures[0];
    if (!firstFixture) throw new Error('scene without fixtures');
    const selected = similarRun(scene.world, fixtureMeshRead(firstFixture));
    expect(new Set(selected)).toEqual(new Set(scene.fixtures));
  });

  it('selects every light named like the clicked light in Objects mode', () => {
    getStateSelectionFilter().modeWrite(SelectionFilterMode.OBJECTS);
    const scene = selectionQuerySimilarSceneCreate(3);
    const marker = LightOwner.markerOf(scene.looseLight);
    if (!marker) throw new Error('light without marker');
    const selected = similarRun(scene.world, marker);
    const expectedLights = LightOwner.collectUnder(scene.world);
    expect(new Set(selected)).toEqual(new Set(expectedLights));
    expect(selected.length).toBe(scene.fixtures.length + 2);
  });
});
