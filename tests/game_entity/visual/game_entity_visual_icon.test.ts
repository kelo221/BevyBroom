import { afterEach, describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { EntityVisualBillboard } from '@/entity/visual/entity_visual_billboard.js';
import { entityIconOf } from '@/entity/icon/entity_icon.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { gameEntityCreateForClass } from '@/game_entity/owner/game_entity_owner.js';
import { GameEntityVisualBuilder } from '@/game_entity/visual/game_entity_visual_builder.js';
import { GAME_ENTITY_ICON_NAME, GameEntityVisualIcon } from '@/game_entity/visual/game_entity_visual_icon.js';
import type { IconName } from '@/ui/icons/icon_name.js';
import {
  testClassesInstall,
  testClassListCreate,
  testDoorClassCreate,
  testSpinnerClassCreate,
} from '../game_entity_test_classes.js';

/** Icon the test door class names. */
const DOOR_ICON: IconName = 'door-closed';

/**
 * Returns the test door class naming an icon.
 *
 * @returns Door class with an icon.
 */
function doorClassWithIcon(): GameEntityClass {
  return { ...testDoorClassCreate(), icon: DOOR_ICON };
}

/**
 * Installs the door naming an icon and the spinner naming none.
 *
 * @returns Uninstall callback.
 */
function classesWithIconInstall(): () => void {
  const list = testClassListCreate();
  list.classes = [doorClassWithIcon(), testSpinnerClassCreate()];
  return testClassesInstall(list).uninstall;
}

/**
 * Returns the geometry the icon billboard of an owner draws.
 *
 * @param owner Game entity owner.
 * @returns Icon geometry, or undefined when the owner has no icon.
 */
function iconGeometryOf(owner: THREE.Object3D): THREE.BufferGeometry | undefined {
  GameEntityVisualBuilder.refresh(owner);
  return EntityVisualBillboard.iconFind(owner)?.geometry;
}

/**
 * Game classes may name the editor icon their entities show on markers, in the
 * outliner and in menus; unknown names fall back to the default icon.
 */
describe('GameEntityVisualIcon', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('uses the icon a class names and the default for none or an unknown name', () => {
    expect(GameEntityVisualIcon.classIconOf(doorClassWithIcon())).toBe(DOOR_ICON);
    expect(GameEntityVisualIcon.classIconOf(testSpinnerClassCreate())).toBe(GAME_ENTITY_ICON_NAME);
    expect(GameEntityVisualIcon.classIconOf({ ...testDoorClassCreate(), icon: 'no-such-icon' })).toBe(
      GAME_ENTITY_ICON_NAME,
    );
  });

  it('gives an entity the icon of its class on the marker and in the outliner', () => {
    cleanups.push(classesWithIconInstall());
    const owner = gameEntityCreateForClass(doorClassWithIcon());
    expect(GameEntityVisualIcon.ownerIconOf(owner)).toBe(DOOR_ICON);
    expect(iconGeometryOf(owner)).toBe(EntityVisualBillboard.geometryOf(DOOR_ICON));
    expect(entityIconOf(owner)?.iconName).toBe(DOOR_ICON);
  });

  it('switches the marker icon back when the class with the icon is removed', () => {
    cleanups.push(classesWithIconInstall());
    const spinner = testSpinnerClassCreate();
    const owner = gameEntityCreateForClass(doorClassWithIcon());
    expect(iconGeometryOf(owner)).toBe(EntityVisualBillboard.geometryOf(DOOR_ICON));
    GameEntityComponentStore.write(owner, { [spinner.type_path]: {} });
    expect(iconGeometryOf(owner)).toBe(EntityVisualBillboard.geometryOf(GAME_ENTITY_ICON_NAME));
  });
});
