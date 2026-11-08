import * as THREE from 'three';
import { EntityClassPoint } from '@/entity/class/entity_class.js';
import { EntityClassRegistry } from '@/entity/class/registry/entity_class_registry.js';
import {
  type GameEntityComponents,
  GameEntityComponentStore,
} from '@/game_entity/component/game_entity_component_store.js';
import type { SprinkleDefinitionCase } from '@/tools/sprinkle/definition/sprinkle_definition.js';
import { SprinkleMark } from '@/tools/sprinkle/mark/sprinkle_mark.js';
import { gameEntityClassIdOf } from '@/game_entity/class/game_entity_class_id.js';

/** World transform a sprinkled entity is placed with. */
export interface SprinkleEntityPlacement {
  /** World position on the surface. */
  readonly position: THREE.Vector3;
  /** World orientation. */
  readonly quaternion: THREE.Quaternion;
}

/**
 * Returns component overrides with the fields of other overrides laid over
 * them, component by component.
 *
 * @param base Overrides kept unless replaced.
 * @param overrides Overrides written over the base.
 * @returns Merged overrides.
 */
export function sprinkleComponentsMerge(
  base: GameEntityComponents,
  overrides: GameEntityComponents,
): GameEntityComponents {
  const merged: GameEntityComponents = structuredClone(base);
  for (const [typePath, fields] of Object.entries(overrides)) {
    merged[typePath] = { ...(merged[typePath] ?? {}), ...fields };
  }
  return merged;
}

/** Creates the entities a sprinkle definition case places. */
export class SprinkleEntityFactory {
  /**
   * Returns the point class a case names, either by entity class id such as
   * `lights.point` or by a game component type path such as `game::Tree`.
   *
   * @param className Entity class id or game component type path of the case.
   * @returns Point class, or null when no point class matches the name.
   */
  static pointClassResolve(className: string): EntityClassPoint | null {
    const entityClass =
      EntityClassRegistry.classFind(className) ?? EntityClassRegistry.classFind(gameEntityClassIdOf(className));
    return entityClass instanceof EntityClassPoint ? entityClass : null;
  }

  /**
   * Creates an entity of a case, marked as sprinkled, carrying the case's
   * component overrides and placed at a world transform below a parent. The
   * entity is not added to the parent.
   *
   * @param pointClass Point class of the case.
   * @param definitionCase Case being placed.
   * @param definitionName Name of the definition the case belongs to.
   * @param placement World transform.
   * @param parent Object the entity will be added to.
   * @returns New entity owner.
   */
  static entityCreate(
    pointClass: EntityClassPoint,
    definitionCase: SprinkleDefinitionCase,
    definitionName: string,
    placement: SprinkleEntityPlacement,
    parent: THREE.Object3D,
  ): THREE.Group {
    const owner = pointClass.ownerCreate();
    const components = sprinkleComponentsMerge(GameEntityComponentStore.read(owner), definitionCase.components);
    GameEntityComponentStore.write(owner, components);
    SprinkleMark.write(owner, definitionName);
    SprinkleEntityFactory.worldTransformApply(owner, placement, parent);
    return owner;
  }

  /**
   * Sets an owner's local transform so it sits at a world transform once added
   * to a parent.
   *
   * @param owner Entity owner.
   * @param placement World transform.
   * @param parent Future parent.
   */
  private static worldTransformApply(
    owner: THREE.Object3D,
    placement: SprinkleEntityPlacement,
    parent: THREE.Object3D,
  ): void {
    parent.updateMatrixWorld(true);
    owner.position.copy(parent.worldToLocal(placement.position.clone()));
    const parentWorldQuaternion = parent.getWorldQuaternion(new THREE.Quaternion());
    owner.quaternion.copy(parentWorldQuaternion.invert().multiply(placement.quaternion));
    owner.updateMatrixWorld(true);
  }
}
