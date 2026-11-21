import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { entityOwnerChildOwners } from '@/entity/model/entity_owner_keys.js';
import { CommandEntitySettingsSet } from '@/entity/commands/command_entity_settings_set.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import type { GameEntityVariantLight } from '@/game_entity/class/game_entity_class_variant_light.js';
import { CommandGameEntityComponentsSet } from '@/game_entity/commands/command_game_entity_components_set.js';
import { GameEntityFixtureLightFollower } from '@/game_entity/fixture_light/game_entity_fixture_light_follower.js';
import { GameEntityFixtureLightMark } from '@/game_entity/fixture_light/game_entity_fixture_light_mark.js';
import { gameEntityCreateForClass } from '@/game_entity/owner/game_entity_owner.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { CommandPrimitiveCreate } from '@/tools/creation/commands/command_primitive_create.js';
import { testClassesInstall, testClassListCreate, testDoorClassCreate } from '../game_entity_test_classes.js';

/** Tube the glass door variant carries: tilted, so its ends differ in height. */
const GLASS_TUBE: GameEntityVariantLight = {
  kind: 'tube',
  from: [-0.5, 2, 0.25],
  to: [0.5, 2.5, 0.25],
  color: [0.88, 0.96, 1],
  intensity: 0.4,
  radius: 9,
  effect: 'fluorescent_starter',
  fog: { intensity: 0.04, thickness: 1, visibility_m: 2, below_floor_m: 0.5 },
};

/** Point light the iron door variant carries. */
const IRON_POINT: GameEntityVariantLight = {
  kind: 'point',
  at: [0, 1.5, 0],
  color: [1, 0.5, 0.25],
  intensity: 2,
  radius: 4,
};

/**
 * Returns the test door whose glass and iron kinds carry lights.
 *
 * @returns Door class with variant lights.
 */
function doorClassWithLights(): GameEntityClass {
  const door = testDoorClassCreate();
  const kindField = door.fields.find((field) => field.path === 'kind');
  if (kindField === undefined) {
    throw new Error('the test door has a kind field');
  }
  kindField.variant_details = { Glass: { label: 'Glass door', light: GLASS_TUBE }, Iron: { light: IRON_POINT } };
  return door;
}

/** Scene, undo stack and follower of one test. */
interface FixtureLightRig {
  readonly world: THREE.Group;
  readonly stack: CommandStack;
  readonly door: GameEntityClass;
}

/**
 * Installs the door class and builds a scene whose undo stack the follower
 * follows.
 *
 * @param cleanups Receives the uninstall callbacks.
 * @returns Test rig.
 */
function rigCreate(cleanups: (() => void)[]): FixtureLightRig {
  const door = doorClassWithLights();
  const list = testClassListCreate();
  list.classes = [door];
  cleanups.push(testClassesInstall(list).uninstall);
  const world = new THREE.Group();
  const stack = new CommandStack(50);
  cleanups.push(new GameEntityFixtureLightFollower(world).follow(stack));
  return { world, stack, door };
}

/**
 * Places a door holding a kind through the undo stack.
 *
 * @param rig Test rig.
 * @param kind Door kind.
 * @param position Where the door stands.
 * @returns The placed door.
 */
function doorPlace(rig: FixtureLightRig, kind: string, position: THREE.Vector3): THREE.Group {
  const owner = gameEntityCreateForClass(rig.door, { [rig.door.type_path]: { kind } });
  owner.position.copy(position);
  rig.stack.push(new CommandPrimitiveCreate(owner, rig.world));
  return owner;
}

/**
 * Changes the kind of a door through the undo stack.
 *
 * @param rig Test rig.
 * @param owner Door.
 * @param kind New kind.
 */
function doorKindSet(rig: FixtureLightRig, owner: THREE.Object3D, kind: string): void {
  rig.stack.push(new CommandGameEntityComponentsSet([owner], () => ({ [rig.door.type_path]: { kind } })));
}

/**
 * Adds a floor slab whose top lies at a height.
 *
 * @param world Scene root.
 * @param topHeight Height of the slab's top face.
 */
function floorAdd(world: THREE.Object3D, topHeight: number): void {
  const slab = new THREE.Mesh(new THREE.BoxGeometry(40, 1, 40), new THREE.MeshBasicMaterial());
  slab.position.set(0, topHeight - 0.5, 0);
  world.add(slab);
}

/**
 * Returns the only light nested under an entity.
 *
 * @param owner Entity owner.
 * @returns The light owner.
 */
function onlyLightOf(owner: THREE.Object3D): THREE.Object3D {
  const lights = entityOwnerChildOwners(owner);
  expect(lights).toHaveLength(1);
  const light = lights[0];
  if (light === undefined) {
    throw new Error('the entity carries a light');
  }
  return light;
}

/**
 * Entities whose enum variant declares a light carry it as a child light that
 * follows the variant, as part of the same undo entry as the edit.
 */
describe('GameEntityFixtureLightFollower', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('gives a placed fixture its tube, centred between the ends with local X along them and −Z rolled down', () => {
    const rig = rigCreate(cleanups);
    const owner = doorPlace(rig, 'Glass', new THREE.Vector3(3, 0, -2));
    const light = onlyLightOf(owner);
    const settings = LightOwner.settingsRead(light);
    const from = new THREE.Vector3(...(GLASS_TUBE.from ?? [0, 0, 0]));
    const to = new THREE.Vector3(...(GLASS_TUBE.to ?? [0, 0, 0]));
    expect(settings?.kind).toBe('tube');
    expect(settings?.tubeLength).toBeCloseTo(from.distanceTo(to), 6);
    expect(light.position.distanceTo(from.clone().add(to).multiplyScalar(0.5))).toBeLessThan(1e-6);
    const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(light.quaternion);
    expect(axis.distanceTo(to.clone().sub(from).normalize())).toBeLessThan(1e-6);
    const backward = new THREE.Vector3(0, 0, -1).applyQuaternion(light.quaternion);
    expect(backward.dot(axis)).toBeCloseTo(0, 6);
    expect(backward.y).toBeLessThan(-0.8);
    expect(new THREE.Vector3(0, -1, 0).projectOnPlane(axis).normalize().distanceTo(backward)).toBeLessThan(1e-6);
    expect(settings?.effectKind).toBe(GLASS_TUBE.effect);
    expect(settings?.realtime).toBe(true);
  });

  it('writes the variant color in sRGB and lets the fog reach the floor and the extra depth below it', () => {
    const rig = rigCreate(cleanups);
    const floorHeight = -1;
    floorAdd(rig.world, floorHeight);
    const owner = doorPlace(rig, 'Glass', new THREE.Vector3(0, 0, 0));
    const light = onlyLightOf(owner);
    const settings = LightOwner.settingsRead(light);
    const expectedHex = new THREE.Color()
      .setRGB(...GLASS_TUBE.color, THREE.LinearSRGBColorSpace)
      .getHex(THREE.SRGBColorSpace);
    expect(settings?.colorHex).toBe(expectedHex);
    const lightHeight = light.getWorldPosition(new THREE.Vector3()).y;
    expect(settings?.fogEnabled).toBe(true);
    expect(settings?.fogShape).toBe('frustum');
    expect(settings?.fogRadius).toBeCloseTo(lightHeight - floorHeight + (GLASS_TUBE.fog?.below_floor_m ?? 0), 5);
    expect(settings?.fogVisibility).toBe(GLASS_TUBE.fog?.visibility_m);
  });

  it('undoes the light together with the placement and redoes both', () => {
    const rig = rigCreate(cleanups);
    const owner = doorPlace(rig, 'Glass', new THREE.Vector3());
    const light = onlyLightOf(owner);
    expect(rig.stack.getUndoCount()).toBe(1);
    rig.stack.undo();
    expect(owner.parent).toBeNull();
    expect(light.parent).toBeNull();
    rig.stack.redo();
    expect(owner.parent).toBe(rig.world);
    expect(light.parent).toBe(owner);
  });

  it('makes the light again when the variant changes and removes it for a variant without one', () => {
    const rig = rigCreate(cleanups);
    const owner = doorPlace(rig, 'Glass', new THREE.Vector3());
    const tube = onlyLightOf(owner);
    doorKindSet(rig, owner, 'Iron');
    const point = onlyLightOf(owner);
    expect(point).not.toBe(tube);
    expect(LightOwner.settingsRead(point)?.kind).toBe('point');
    expect(point.position.toArray()).toEqual(IRON_POINT.at);
    doorKindSet(rig, owner, 'Wooden');
    expect(entityOwnerChildOwners(owner)).toHaveLength(0);
    rig.stack.undo();
    expect(onlyLightOf(owner)).toBe(point);
  });

  it("keeps the designer's edits while the variant stays and never touches lights the designer added", () => {
    const rig = rigCreate(cleanups);
    const owner = doorPlace(rig, 'Glass', new THREE.Vector3());
    const light = onlyLightOf(owner);
    rig.stack.push(new CommandEntitySettingsSet(LightOwner, [light], (current) => ({ ...current, intensity: 7 })));
    const ownLight = LightOwner.createDefault('Extra lamp');
    rig.stack.push(new CommandPrimitiveCreate(ownLight, owner));
    expect(onlyLightOfMarked(owner)).toBe(light);
    expect(LightOwner.settingsRead(light)?.intensity).toBe(7);
    doorKindSet(rig, owner, 'Wooden');
    expect(entityOwnerChildOwners(owner)).toEqual([ownLight]);
  });
});

/**
 * Returns the only light under an entity made from a variant.
 *
 * @param owner Entity owner.
 * @returns The marked light.
 */
function onlyLightOfMarked(owner: THREE.Object3D): THREE.Object3D | undefined {
  const marked = GameEntityFixtureLightMark.childrenMarked(owner);
  expect(marked).toHaveLength(1);
  return marked[0];
}
