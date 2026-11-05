import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  ENTITY_KIND_USERDATA_KEY,
  ENTITY_VISUAL_PART_USERDATA_KEY,
  entityKindRegister,
} from '@/entity/model/entity_owner_keys.js';
import { SelectionFilterTargetResolver } from '@/selection/filter/selection_filter_target_resolver.js';
import { StateSelectionFilter } from '@/selection/filter/state_selection_filter.js';
import { SOLID_BRUSH_USERDATA_KEY } from '@/solid/model/solid_brush_visual.js';
import { SOLID_MODEL_USERDATA_KEY } from '@/solid/model/solid_model_keys.js';
import { SelectionFilterMode } from '@/types/selection_filter_mode.js';

const TEST_ENTITY_KIND = 'selection_filter_test_kind';

/** Scene built for each case: world, nested user groups, solid, entity, mesh. */
interface ResolverTestScene {
  world: THREE.Group;
  outerGroup: THREE.Group;
  innerGroup: THREE.Group;
  solidRoot: THREE.Group;
  brush: THREE.Mesh;
  entityOwner: THREE.Group;
  entityPickMesh: THREE.Mesh;
  entityContentMesh: THREE.Mesh;
  looseMesh: THREE.Mesh;
  groupedMesh: THREE.Mesh;
}

/**
 * Builds a world with an outer user group holding an inner group, which holds a
 * solid model with one brush, an entity owner and a plain mesh.
 *
 * @returns Created scene objects.
 */
function resolverTestSceneCreate(): ResolverTestScene {
  entityKindRegister(TEST_ENTITY_KIND);
  const world = new THREE.Group();
  const outerGroup = new THREE.Group();
  const innerGroup = new THREE.Group();
  const solidRoot = new THREE.Group();
  solidRoot.userData[SOLID_MODEL_USERDATA_KEY] = true;
  const brush = new THREE.Mesh();
  brush.userData[SOLID_BRUSH_USERDATA_KEY] = true;
  const entityOwner = new THREE.Group();
  entityOwner.userData[ENTITY_KIND_USERDATA_KEY] = TEST_ENTITY_KIND;
  const entityPickMesh = new THREE.Mesh();
  entityPickMesh.userData[ENTITY_VISUAL_PART_USERDATA_KEY] = true;
  const entityContentMesh = new THREE.Mesh();
  const looseMesh = new THREE.Mesh();
  const groupedMesh = new THREE.Mesh();
  solidRoot.add(brush);
  entityOwner.add(entityPickMesh, entityContentMesh);
  innerGroup.add(solidRoot, entityOwner, groupedMesh);
  outerGroup.add(innerGroup);
  world.add(outerGroup, looseMesh);
  return {
    world,
    outerGroup,
    innerGroup,
    solidRoot,
    brush,
    entityOwner,
    entityPickMesh,
    entityContentMesh,
    looseMesh,
    groupedMesh,
  };
}

describe('SelectionFilterTargetResolver', () => {
  it('Groups mode resolves any hit inside nested user groups to the outermost group below the world', () => {
    const scene = resolverTestSceneCreate();
    const resolver = new SelectionFilterTargetResolver(new StateSelectionFilter());
    for (const hit of [scene.brush, scene.entityPickMesh, scene.groupedMesh, scene.innerGroup]) {
      expect(resolver.targetResolve(hit, scene.world, SelectionFilterMode.GROUPS)).toBe(scene.outerGroup);
    }
  });

  it('Groups mode resolves ungrouped objects to their logical object', () => {
    const scene = resolverTestSceneCreate();
    const resolver = new SelectionFilterTargetResolver(new StateSelectionFilter());
    expect(resolver.targetResolve(scene.looseMesh, scene.world, SelectionFilterMode.GROUPS)).toBe(scene.looseMesh);
    scene.world.add(scene.entityOwner);
    expect(resolver.targetResolve(scene.entityPickMesh, scene.world, SelectionFilterMode.GROUPS)).toBe(
      scene.entityOwner,
    );
  });

  it('Objects mode resolves to the solid root, the entity owner, or the mesh itself', () => {
    const scene = resolverTestSceneCreate();
    const resolver = new SelectionFilterTargetResolver(new StateSelectionFilter());
    expect(resolver.targetResolve(scene.brush, scene.world, SelectionFilterMode.OBJECTS)).toBe(scene.solidRoot);
    expect(resolver.targetResolve(scene.entityPickMesh, scene.world, SelectionFilterMode.OBJECTS)).toBe(
      scene.entityOwner,
    );
    expect(resolver.targetResolve(scene.entityContentMesh, scene.world, SelectionFilterMode.OBJECTS)).toBe(
      scene.entityOwner,
    );
    expect(resolver.targetResolve(scene.groupedMesh, scene.world, SelectionFilterMode.OBJECTS)).toBe(scene.groupedMesh);
  });

  it('Solids mode resolves to the individual brush or content mesh, but entity visuals to their owner', () => {
    const scene = resolverTestSceneCreate();
    const resolver = new SelectionFilterTargetResolver(new StateSelectionFilter());
    expect(resolver.targetResolve(scene.brush, scene.world, SelectionFilterMode.SOLIDS)).toBe(scene.brush);
    expect(resolver.targetResolve(scene.entityContentMesh, scene.world, SelectionFilterMode.SOLIDS)).toBe(
      scene.entityContentMesh,
    );
    expect(resolver.targetResolve(scene.groupedMesh, scene.world, SelectionFilterMode.SOLIDS)).toBe(scene.groupedMesh);
    expect(resolver.targetResolve(scene.entityPickMesh, scene.world, SelectionFilterMode.SOLIDS)).toBe(
      scene.entityOwner,
    );
  });

  it('defaults to the effective mode of the filter state and treats Ignore Groups as Objects', () => {
    const scene = resolverTestSceneCreate();
    const state = new StateSelectionFilter();
    const resolver = new SelectionFilterTargetResolver(state);
    state.modeWrite(SelectionFilterMode.GROUPS);
    expect(resolver.targetResolve(scene.brush, scene.world)).toBe(scene.outerGroup);
    state.ignoreGroupsWrite(true);
    expect(resolver.targetResolve(scene.brush, scene.world)).toBe(scene.solidRoot);
    state.modeWrite(SelectionFilterMode.SOLIDS);
    expect(resolver.targetResolve(scene.brush, scene.world)).toBe(scene.brush);
  });
});
