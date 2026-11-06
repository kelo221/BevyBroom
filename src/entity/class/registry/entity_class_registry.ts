import type * as THREE from 'three';
import { type EntityClass, EntityClassPoint } from '@/entity/class/entity_class.js';
import { EntityClassPointGame } from '@/entity/class/classes/entity_class_point_game.js';
import { RegistryExtensible } from '@/utils/registry/registry_extensible.js';
import { type EntityClassProvider, entityClassProvidersBuiltin } from './entity_class_registry_builtin.js';

/** Id of the class the Entity tool falls back to without game classes. */
const ENTITY_CLASS_POINT_FALLBACK_ID = 'lights.point';

/**
 * Every class a scene object can be, merged from class providers: the point
 * classes of the entity kinds, the game classes and the brush classes, plus
 * providers features register at runtime.
 */
export class EntityClassRegistry {
  private static readonly providers = new RegistryExtensible<EntityClassProvider>(entityClassProvidersBuiltin);

  /**
   * Adds a class provider after the built-in ones.
   *
   * @param provider Class provider.
   */
  static providerRegister(provider: EntityClassProvider): void {
    EntityClassRegistry.providers.register(provider);
  }

  /**
   * Removes a provider added with {@link providerRegister}.
   *
   * @param provider Class provider.
   */
  static providerUnregister(provider: EntityClassProvider): void {
    EntityClassRegistry.providers.unregister(provider);
  }

  /**
   * Returns every class in display order, keeping the first class of each id.
   *
   * @returns Classes.
   */
  static classesList(): EntityClass[] {
    const classesById = new Map<string, EntityClass>();
    for (const entityClass of EntityClassRegistry.providers.list().flatMap((provider) => provider())) {
      if (!classesById.has(entityClass.id)) {
        classesById.set(entityClass.id, entityClass);
      }
    }
    return [...classesById.values()];
  }

  /**
   * Returns the classes placed as points of their own.
   *
   * @returns Point classes in display order.
   */
  static pointClassesList(): EntityClassPoint[] {
    return EntityClassRegistry.classesList().filter(
      (entityClass): entityClass is EntityClassPoint => entityClass instanceof EntityClassPoint,
    );
  }

  /**
   * Returns the point classes the Entity tool offers for placing new entities.
   *
   * @returns Placeable point classes in display order.
   */
  static pointClassesPlaceableList(): EntityClassPoint[] {
    return EntityClassRegistry.pointClassesList().filter((entityClass) => entityClass.placeableIs());
  }

  /**
   * Returns the classes brushes carry.
   *
   * @returns Brush classes in display order.
   */
  static brushClassesList(): EntityClass[] {
    return EntityClassRegistry.classesList().filter((entityClass) => entityClass.placement === 'brush');
  }

  /**
   * Returns the classes an object may become.
   *
   * @param object Scene object.
   * @returns Fitting classes in display order.
   */
  static classesFittingList(object: THREE.Object3D): EntityClass[] {
    return EntityClassRegistry.classesList().filter((entityClass) => entityClass.canApplyTo(object));
  }

  /**
   * Returns the class with an id.
   *
   * @param id Class id.
   * @returns The class, or null when no provider offers it.
   */
  static classFind(id: string): EntityClass | null {
    return EntityClassRegistry.classesList().find((entityClass) => entityClass.id === id) ?? null;
  }

  /**
   * Returns the class an object is of: the first fitting class that matches it.
   *
   * @param object Scene object.
   * @returns The class, or null when none matches.
   */
  static classOf(object: THREE.Object3D): EntityClass | null {
    return EntityClassRegistry.classesFittingList(object).find((entityClass) => entityClass.matches(object)) ?? null;
  }

  /**
   * Returns the point class new entities start with: the first placeable game
   * class, or the point light when the game reported none.
   *
   * @returns Default point class, or null without placeable point classes.
   */
  static pointClassDefault(): EntityClassPoint | null {
    const pointClasses = EntityClassRegistry.pointClassesPlaceableList();
    const firstGameClass = pointClasses.find((entityClass) => entityClass instanceof EntityClassPointGame);
    const fallback = pointClasses.find((entityClass) => entityClass.id === ENTITY_CLASS_POINT_FALLBACK_ID);
    return firstGameClass ?? fallback ?? pointClasses[0] ?? null;
  }
}
