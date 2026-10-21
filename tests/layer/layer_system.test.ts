import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LayerSystem } from '@/layer/layer_system.js';
import { LayerManagerLookup } from '@/layer/model/layer_manager_lookup.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { createLayoutCoreSystems } from '@/layout/setup/layout_core_bootstrap.js';

/**
 * Unit tests for the layer system the layout creates: it binds a manager to the
 * world, hooks the scene the world is put into, and releases everything on
 * dispose.
 */
describe('LayerSystem', () => {
  it('binds the manager to the world and hooks the scene holding the world', () => {
    const world = new THREE.Group();
    const system = new LayerSystem(world, new ManagerSelection());
    const scene = new THREE.Scene();
    scene.add(world);
    expect(LayerManagerLookup.find(world)).toBe(system.layerManager);
    expect(system.renderSuppression.hookedSceneRead()).toBe(scene);
    system.dispose();
    expect(LayerManagerLookup.find(world)).toBeNull();
    expect(system.renderSuppression.hookedSceneRead()).toBeNull();
  });

  it('is created once by the layout core for its world', () => {
    const systems = createLayoutCoreSystems();
    expect(systems.layerManager).toBe(systems.layerSystem.layerManager);
    expect(LayerManagerLookup.find(systems.worldObject)).toBe(systems.layerManager);
    systems.layerSystem.dispose();
  });
});
