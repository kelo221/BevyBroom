import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { IssueProviderGameComponentUnknown } from '@/info_panel/issues/providers/issue_provider_game_component_unknown.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { TEST_DOOR_TYPE_PATH, testClassesInstall } from '../../../game_entity/game_entity_test_classes.js';

/**
 * Unit tests for the unknown game component issue provider: components of known
 * classes are fine, components of unknown classes are reported on their
 * object.
 */
describe('IssueProviderGameComponentUnknown', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('reports each component whose class is unknown, on the object carrying it', () => {
    cleanups.push(testClassesInstall().uninstall);
    const world = new THREE.Group();
    const holder = new THREE.Object3D();
    holder.name = `Holder ${Math.floor(Math.random() * 1000)}`;
    world.add(new THREE.Object3D().add(holder));
    const unknownTypePath = `unknown_game::Thing${Math.floor(Math.random() * 1000)}`;
    GameEntityComponentStore.write(holder, { [TEST_DOOR_TYPE_PATH]: {}, [unknownTypePath]: {} });
    const issues = new IssueProviderGameComponentUnknown().collect(world);
    expect(issues.length).toBe(1);
    expect(issues[0]?.severity).toBe('warning');
    expect(issues[0]?.objectUuid).toBe(holder.uuid);
    expect(issues[0]?.objectName).toBe(holder.name);
    expect(issues[0]?.description).toContain(unknownTypePath);
  });

  it('reports nothing once the class becomes known', () => {
    const world = new THREE.Group();
    const holder = new THREE.Object3D();
    world.add(holder);
    GameEntityComponentStore.write(holder, { [TEST_DOOR_TYPE_PATH]: {} });
    const provider = new IssueProviderGameComponentUnknown();
    expect(provider.collect(world).length).toBe(1);
    cleanups.push(testClassesInstall().uninstall);
    expect(provider.collect(world)).toEqual([]);
  });
});
