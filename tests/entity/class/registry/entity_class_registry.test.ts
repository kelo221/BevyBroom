import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EntityClassPointGame } from '@/entity/class/classes/entity_class_point_game.js';
import { EntityClassBrush, EntityClassPoint } from '@/entity/class/entity_class.js';
import { EntityClassRegistry } from '@/entity/class/registry/entity_class_registry.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { PortalOwner } from '@/portal/model/portal_owner.js';
import { RoomOwner } from '@/portal/model/room_owner.js';
import { GAME_ENTITY_CLASS_CATEGORY_DATA } from '@/game_entity/class/game_entity_class_category_data.js';
import {
  TEST_DOOR_TYPE_PATH,
  TEST_SPINNER_TYPE_PATH,
  testClassesInstall,
  testDoorClassCreate,
} from '../../../game_entity/game_entity_test_classes.js';

/**
 * Returns the point class with a label or fails the test.
 *
 * @param label Class label.
 * @returns Point class.
 */
function pointClassByLabel(label: string): EntityClassPoint {
  const found = EntityClassRegistry.pointClassesList().find((entityClass) => entityClass.label === label);
  if (!found) throw new Error(`expected a point class labelled ${label}`);
  return found;
}

/**
 * The class registry lists the light, room, portal and game point classes for
 * the Class dropdown and the Entity tool, the brush classes for brushes, and
 * recognizes the class of objects created from a class.
 */
describe('EntityClassRegistry', () => {
  let uninstall: () => void = () => {};

  afterEach(() => {
    uninstall();
    uninstall = () => {};
  });

  it('lists point and spot lights, rooms, portals and every game class as point classes', () => {
    uninstall = testClassesInstall().uninstall;
    const labels = EntityClassRegistry.pointClassesList().map((entityClass) => entityClass.label);
    expect(labels).toEqual(expect.arrayContaining(['Point Light', 'Spot Light', 'Room', 'Portal', 'Door', 'Spinner']));
    for (const entityClass of EntityClassRegistry.pointClassesList()) {
      expect(entityClass.placement).toBe('point');
      expect(entityClass.helpText).not.toBe('');
      expect(entityClass.category).not.toBe('');
    }
  });

  it('keeps every class id unique', () => {
    uninstall = testClassesInstall().uninstall;
    const ids = EntityClassRegistry.classesList().map((entityClass) => entityClass.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('offers plain world brushes and the game classes placeable on any object as brush classes', () => {
    uninstall = testClassesInstall().uninstall;
    const brushClasses = EntityClassRegistry.brushClassesList();
    const labels = brushClasses.map((entityClass) => entityClass.label);
    expect(labels).toContain('Solid (world)');
    expect(labels).toContain('Spinner');
    expect(labels).not.toContain('Door');
    expect(brushClasses.every((entityClass) => entityClass instanceof EntityClassBrush)).toBe(true);
  });

  it('creates owners each point class recognizes as its own', () => {
    uninstall = testClassesInstall().uninstall;
    for (const pointClass of EntityClassRegistry.pointClassesList()) {
      const owner = pointClass.ownerCreate();
      expect(EntityClassRegistry.classOf(owner)?.id).toBe(pointClass.id);
    }
  });

  it('tells lights, rooms and portals apart by their owner kind', () => {
    expect(LightOwner.isOwner(pointClassByLabel('Spot Light').ownerCreate())).toBe(true);
    expect(RoomOwner.isOwner(pointClassByLabel('Room').ownerCreate())).toBe(true);
    expect(PortalOwner.isOwner(pointClassByLabel('Portal').ownerCreate())).toBe(true);
  });

  it('sees a brush as Solid (world) until it carries a brush game class', () => {
    uninstall = testClassesInstall().uninstall;
    const brush = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    expect(EntityClassRegistry.classOf(brush)?.label).toBe('Solid (world)');
    GameEntityComponentStore.write(brush, { [TEST_SPINNER_TYPE_PATH]: {} });
    expect(EntityClassRegistry.classOf(brush)?.label).toBe('Spinner');
    expect(
      EntityClassRegistry.classesFittingList(brush).every((entityClass) => entityClass.placement === 'brush'),
    ).toBe(true);
  });

  it('defaults new entities to the first placeable game class in display order', () => {
    uninstall = testClassesInstall().uninstall;
    const firstGameClass = EntityClassRegistry.pointClassesList().find(
      (entityClass) => entityClass instanceof EntityClassPointGame && entityClass.placeableIs(),
    );
    expect(firstGameClass).toBeDefined();
    expect(EntityClassRegistry.pointClassDefault()?.id).toBe(firstGameClass?.id);
    expect(GameEntityComponentStore.read(pointClassByLabel('Door').ownerCreate())).toHaveProperty(TEST_DOOR_TYPE_PATH);
  });

  it('keeps data-only game classes out of the placeable classes and the default', () => {
    const dataClass = testDoorClassCreate();
    dataClass.type_path = `test_game::data::Notes${Math.random().toString(36).slice(2)}`;
    dataClass.label = 'Notes';
    dataClass.category = GAME_ENTITY_CLASS_CATEGORY_DATA;
    uninstall = testClassesInstall({
      generation: 1,
      asset_generation: 0,
      classes: [dataClass],
      asset_types: [],
    }).uninstall;
    const placeableLabels = EntityClassRegistry.pointClassesPlaceableList().map((entityClass) => entityClass.label);
    expect(placeableLabels).not.toContain(dataClass.label);
    expect(placeableLabels).toContain('Point Light');
    expect(EntityClassRegistry.pointClassesList().map((entityClass) => entityClass.label)).toContain(dataClass.label);
    expect(EntityClassRegistry.pointClassDefault()?.label).toBe('Point Light');
  });

  it('defaults new entities to the point light while no provider offers a game class', () => {
    const gameClassesHidden = vi.spyOn(GameEntityClassRegistry, 'classesList').mockReturnValue([]);
    expect(EntityClassRegistry.pointClassDefault()?.label).toBe('Point Light');
    gameClassesHidden.mockRestore();
  });

  it('lists classes features register at runtime until they unregister them', () => {
    const extraClass = pointClassByLabel('Point Light');
    const renamed = Object.assign(
      Object.create(Object.getPrototypeOf(extraClass) as object) as EntityClassPoint,
      extraClass,
      {
        id: 'test.extra_light',
        label: 'Extra Light',
      },
    );
    const provider = (): readonly EntityClassPoint[] => [renamed];
    EntityClassRegistry.providerRegister(provider);
    expect(EntityClassRegistry.classFind('test.extra_light')?.label).toBe('Extra Light');
    EntityClassRegistry.providerUnregister(provider);
    expect(EntityClassRegistry.classFind('test.extra_light')).toBeNull();
  });
});
