import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { IssueProviderCollisionVolumeUndeclared } from '@/info_panel/issues/providers/issue_provider_collision_volume_undeclared.js';
import { issueProvidersBuiltin } from '@/info_panel/issues/issue_provider_builtin.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { CollisionKindStore } from '@/level_export/kind/collision_kind_store.js';
import {
  TEST_DOOR_TYPE_PATH,
  testClassListCreate,
  testClassesInstall,
} from '../../../game_entity/game_entity_test_classes.js';

const ZONE_TYPE_PATH = 'volume_issue_test::Zone';

/**
 * Installs the test classes plus a zone class that declares a volume.
 *
 * @returns Function that removes the classes again.
 */
function zoneClassesInstall(): () => void {
  const list = testClassListCreate();
  list.classes.push({
    type_path: ZONE_TYPE_PATH,
    label: 'Zone label',
    category: 'Zones',
    placement: 'any',
    marker_color: [0.2, 0.4, 0.9],
    collision: 'volume',
    fields: [],
  });
  return testClassesInstall(list).uninstall;
}

/**
 * Creates a named object below a world.
 *
 * @param world Parent world.
 * @param kind Collision kind to override with, or null to take the declared
 *   one.
 * @returns The object.
 */
function objectCreate(world: THREE.Object3D, kind: 'volume' | 'solid' | null): THREE.Object3D {
  const object = new THREE.Object3D();
  object.name = `Object ${Math.floor(Math.random() * 100000)}`;
  CollisionKindStore.overrideWrite(object, kind);
  world.add(object);
  return object;
}

/**
 * Unit tests for the trigger box without a purpose check: a warning for objects
 * forced to Volume that no component makes a trigger box.
 */
describe('IssueProviderCollisionVolumeUndeclared', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('is built in', () => {
    const ids = issueProvidersBuiltin().map((provider) => provider.id);
    expect(ids).toContain(new IssueProviderCollisionVolumeUndeclared().id);
  });

  it('warns, never errors, about a forced volume and names the components that make a trigger box', () => {
    cleanups.push(zoneClassesInstall());
    const world = new THREE.Group();
    const forced = objectCreate(world, 'volume');
    const issues = new IssueProviderCollisionVolumeUndeclared().collect(world);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('warning');
    expect(issues[0]?.objectUuid).toBe(forced.uuid);
    expect(issues[0]?.description).toContain(`${forced.name} is set to Trigger box (Collision: Volume)`);
    expect(issues[0]?.description).toContain('Zone label');
    expect(issues[0]?.description).not.toContain('Door');
  });

  it('stays quiet for solid objects, declared volumes and objects whose class declares a volume', () => {
    cleanups.push(zoneClassesInstall());
    const world = new THREE.Group();
    objectCreate(world, null);
    objectCreate(world, 'solid');
    const declared = objectCreate(world, 'volume');
    GameEntityComponentStore.write(declared, { [ZONE_TYPE_PATH]: {} });
    expect(new IssueProviderCollisionVolumeUndeclared().collect(world)).toEqual([]);
  });

  it('warns when the object only has components of classes that do not declare a volume', () => {
    cleanups.push(zoneClassesInstall());
    const world = new THREE.Group();
    const forced = objectCreate(world, 'volume');
    GameEntityComponentStore.write(forced, { [TEST_DOOR_TYPE_PATH]: {} });
    expect(new IssueProviderCollisionVolumeUndeclared().collect(world)).toHaveLength(1);
  });

  it('still explains the fix when no loaded class declares a volume', () => {
    const world = new THREE.Group();
    objectCreate(world, 'volume');
    const description = new IssueProviderCollisionVolumeUndeclared().collect(world)[0]?.description ?? '';
    expect(description).toContain('Set Collision back to "From class"');
    expect(description).toContain('a component that makes it a trigger box');
  });
});
