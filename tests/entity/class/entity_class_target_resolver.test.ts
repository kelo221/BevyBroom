import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EntityClassRegistry } from '@/entity/class/registry/entity_class_registry.js';
import {
  entityClassFindByText,
  entityClassOfferedIs,
  entityClassesFittingAll,
} from '@/entity/class/entity_class_target_resolver.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { GAME_ENTITY_PROPERTIES_TYPE_PATH } from '@/game_entity/class/game_entity_class_provider_builtin.js';
import { testClassesInstall } from '../../game_entity/game_entity_test_classes.js';

/**
 * The class-target resolver finds classes by label or id and lists the classes
 * every object may become, skipping data-only point classes.
 */
describe('entityClassTargetResolver', () => {
  let uninstall: () => void = () => {};

  beforeEach(() => {
    uninstall = testClassesInstall().uninstall;
  });

  afterEach(() => {
    uninstall();
  });

  it('finds a class by label ignoring case, then by id', () => {
    const classes = EntityClassRegistry.classesList();
    expect(entityClassFindByText(classes, 'point light')?.id).toBe('lights.point');
    expect(entityClassFindByText(classes, 'lights.spot')?.label).toBe('Spot Light');
    expect(entityClassFindByText(classes, '')).toBeNull();
    expect(entityClassFindByText(classes, 'no_such_class')).toBeNull();
  });

  it('lists fitting placeable classes for a light and hides data-only classes', () => {
    const light = LightOwner.createDefault('ResolverLight');
    const fitting = entityClassesFittingAll([light]);
    expect(fitting.map((entityClass) => entityClass.id)).toContain('lights.point');
    expect(fitting.some((entityClass) => entityClass.label === 'Door')).toBe(true);
    const properties = EntityClassRegistry.classesList().find((entityClass) =>
      entityClass.id.includes(GAME_ENTITY_PROPERTIES_TYPE_PATH),
    );
    expect(properties).toBeDefined();
    if (!properties) {
      return;
    }
    expect(entityClassOfferedIs(properties)).toBe(false);
    expect(fitting).not.toContain(properties);
  });
});
