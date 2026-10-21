import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameEntityClassProvider } from '@/game_entity/class/game_entity_class_provider.js';
import { GAME_ENTITY_PROPERTIES_TYPE_PATH } from '@/game_entity/class/game_entity_class_provider_builtin.js';
import { GameEntityClassProviderScene } from '@/game_entity/class/game_entity_class_provider_scene.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { gameEntityClassListEmpty } from '@/game_entity/class/game_entity_class_schema.js';
import { TEST_DOOR_TYPE_PATH, testClassesInstall, testDoorClassCreate } from '../game_entity_test_classes.js';

/**
 * The registry merges every provider: more trusted providers hide the same
 * class from later ones, and every provider change reaches the listeners.
 */
describe('GameEntityClassRegistry', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    GameEntityClassProviderScene.shared.listWrite(gameEntityClassListEmpty());
  });

  it('always knows the bridge properties class', () => {
    expect(GameEntityClassRegistry.classFind(GAME_ENTITY_PROPERTIES_TYPE_PATH)?.fields[0]?.kind).toBe('property_map');
  });

  it('lists classes of registered providers and forgets them when unregistered', () => {
    const { uninstall } = testClassesInstall();
    expect(GameEntityClassRegistry.classFind(TEST_DOOR_TYPE_PATH)?.label).toBe(testDoorClassCreate().label);
    uninstall();
    expect(GameEntityClassRegistry.classFind(TEST_DOOR_TYPE_PATH)).toBeNull();
  });

  it('prefers the class of the more trusted provider', () => {
    const sceneDoor = { ...testDoorClassCreate(), label: 'Saved Door' };
    GameEntityClassProviderScene.shared.listWrite({ ...gameEntityClassListEmpty(), classes: [sceneDoor] });
    const later = new GameEntityClassProvider('later');
    later.listWrite({ ...gameEntityClassListEmpty(), classes: [{ ...sceneDoor, label: 'Later Door' }] });
    GameEntityClassRegistry.providerRegister(later);
    cleanups.push(() => GameEntityClassRegistry.providerUnregister(later));
    expect(GameEntityClassRegistry.classFind(TEST_DOOR_TYPE_PATH)?.label).toBe('Saved Door');
    expect(
      GameEntityClassRegistry.classesList().filter((entry) => entry.type_path === TEST_DOOR_TYPE_PATH),
    ).toHaveLength(1);
  });

  it('tells listeners and changes the generation when a provider changes', () => {
    const { provider, uninstall } = testClassesInstall();
    cleanups.push(uninstall);
    const listener = vi.fn();
    cleanups.push(GameEntityClassRegistry.changeListenerAdd(listener));
    const before = GameEntityClassRegistry.generation();
    provider.listWrite(gameEntityClassListEmpty());
    expect(listener).toHaveBeenCalledTimes(1);
    expect(GameEntityClassRegistry.generation()).not.toBe(before);
  });

  it('sorts classes by category and label', () => {
    const { uninstall } = testClassesInstall();
    cleanups.push(uninstall);
    const keys = GameEntityClassRegistry.classesList().map((entry) => `${entry.category}\u0000${entry.label}`);
    expect(keys).toEqual([...keys].sort((first, second) => first.localeCompare(second)));
  });
});
