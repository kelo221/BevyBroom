import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { IssueProviderGameComponentOnBrush } from '@/info_panel/issues/providers/issue_provider_game_component_on_brush.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';

/**
 * Builds a world with one solid model of one brush.
 *
 * @returns World root, model and brush mesh.
 */
function worldCreate(): { world: THREE.Group; model: SolidModel; brushMesh: THREE.Object3D } {
  const world = new THREE.Group();
  const model = new SolidModel('ComponentsOnBrush');
  const brushMesh = model.addBoxBrush(2, SolidOperation.Additive).mesh;
  if (!brushMesh) {
    throw new Error('brush has no mesh');
  }
  world.add(model.root);
  return { world, model, brushMesh };
}

/** Unit tests for the check of game components the game never receives. */
describe('IssueProviderGameComponentOnBrush', () => {
  it('reports an error for components stored on a brush', () => {
    const { world, brushMesh } = worldCreate();
    GameEntityComponentStore.write(brushMesh, { 'game::Door': {} });
    const issues = new IssueProviderGameComponentOnBrush().collect(world);
    expect(issues.map((issue) => [issue.severity, issue.objectUuid])).toEqual([['error', brushMesh.uuid]]);
  });

  it('accepts components on the solid model root', () => {
    const { world, model } = worldCreate();
    GameEntityComponentStore.write(model.root, { 'game::Door': {} });
    expect(new IssueProviderGameComponentOnBrush().collect(world)).toEqual([]);
  });

  it('reports nothing for brushes without components', () => {
    expect(new IssueProviderGameComponentOnBrush().collect(worldCreate().world)).toEqual([]);
  });
});
