import type * as THREE from 'three';
import type { Issue } from '@/info_panel/issues/issue.js';
import { IssueProvider } from '@/info_panel/issues/issue_provider.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';
import {
  GameEntityComponentStore,
  type GameEntityComponents,
} from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityVisualMarkerBox } from '@/game_entity/visual/game_entity_visual_marker_box.js';

/** Stable id of the unknown variant issue provider. */
export const ISSUE_PROVIDER_GAME_ENTITY_VARIANT_UNKNOWN_ID = 'game_entity_variant_unknown';

/**
 * Reports objects whose class picks its marker by an enum field that holds a
 * value the field does not list, such as a fixture id the game has renamed.
 * Such objects show a plain marker instead of a model.
 */
export class IssueProviderGameEntityVariantUnknown extends IssueProvider {
  /** Creates the provider. */
  constructor() {
    super(ISSUE_PROVIDER_GAME_ENTITY_VARIANT_UNKNOWN_ID, 'Unknown variants');
  }

  /**
   * Collects one warning per object and class holding an unlisted value.
   *
   * @param worldGroup Scene root.
   * @returns Issues in traversal order.
   */
  collect(worldGroup: THREE.Object3D): Issue[] {
    const issues: Issue[] = [];
    worldGroup.traverse((object) => {
      issues.push(...this.objectIssuesCollect(object));
    });
    return issues;
  }

  /**
   * Returns the issues of one object.
   *
   * @param object Scene object.
   * @returns One warning per known class whose marker field holds an unlisted
   *   value.
   */
  private objectIssuesCollect(object: THREE.Object3D): Issue[] {
    const components = GameEntityComponentStore.read(object);
    return Object.keys(components)
      .map((typePath) => GameEntityClassRegistry.classFind(typePath))
      .filter((gameClass): gameClass is GameEntityClass => gameClass !== null)
      .flatMap((gameClass) => this.classIssuesCollect(object, gameClass, components));
  }

  /**
   * Returns the issue one class gives an object.
   *
   * @param object Scene object.
   * @param gameClass Component class.
   * @param components Component overrides of the object.
   * @returns A warning naming the field and the value, or none.
   */
  private classIssuesCollect(
    object: THREE.Object3D,
    gameClass: GameEntityClass,
    components: GameEntityComponents,
  ): Issue[] {
    const unknownValue = GameEntityVisualMarkerBox.unknownVariantOf(gameClass, components);
    if (unknownValue === null) {
      return [];
    }
    const fieldPath = gameClass.marker_box_field ?? '';
    const fieldLabel = GameEntityComponentResolver.fieldFind(gameClass, fieldPath)?.label ?? fieldPath;
    return [
      this.issueCreate({
        severity: 'warning',
        objectUuid: object.uuid,
        objectName: object.name,
        description: `${gameClass.label} ${fieldLabel} "${unknownValue}" is not one of its values; it shows as a plain box`,
      }),
    ];
  }
}
