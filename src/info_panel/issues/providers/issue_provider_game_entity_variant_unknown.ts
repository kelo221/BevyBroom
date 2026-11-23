import type * as THREE from 'three';
import type { Issue } from '@/info_panel/issues/issue.js';
import { IssueProvider } from '@/info_panel/issues/issue_provider.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';
import { GameEntityComponentValueList } from '@/game_entity/component/game_entity_component_value_list.js';
import {
  GameEntityComponentStore,
  type GameEntityComponents,
} from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityVisualMarkerBox } from '@/game_entity/visual/game_entity_visual_marker_box.js';

/** Stable id of the unknown variant issue provider. */
export const ISSUE_PROVIDER_GAME_ENTITY_VARIANT_UNKNOWN_ID = 'game_entity_variant_unknown';

/**
 * Reports objects whose class picks its marker by an enum field that holds a
 * value the field does not list, such as a fixture id the game has renamed
 * (such objects show a plain marker instead of a model), and every entry of an
 * enum list field the field does not list.
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
   * @returns Warnings of every known class holding unlisted values.
   */
  private objectIssuesCollect(object: THREE.Object3D): Issue[] {
    const components = GameEntityComponentStore.read(object);
    return Object.keys(components)
      .map((typePath) => GameEntityClassRegistry.classFind(typePath))
      .filter((gameClass): gameClass is GameEntityClass => gameClass !== null)
      .flatMap((gameClass) => this.classIssuesCollect(object, gameClass, components));
  }

  /**
   * Returns the issues one class gives an object.
   *
   * @param object Scene object.
   * @param gameClass Component class.
   * @param components Component overrides of the object.
   * @returns Warnings naming the field and each unlisted value.
   */
  private classIssuesCollect(
    object: THREE.Object3D,
    gameClass: GameEntityClass,
    components: GameEntityComponents,
  ): Issue[] {
    return [
      ...this.markerFieldIssuesCollect(object, gameClass, components),
      ...this.enumListIssuesCollect(object, gameClass, components),
    ];
  }

  /**
   * Returns the issue the marker box enum field of one class gives an object.
   *
   * @param object Scene object.
   * @param gameClass Component class.
   * @param components Component overrides of the object.
   * @returns A warning naming the field and the value, or none.
   */
  private markerFieldIssuesCollect(
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
      this.warningCreate(
        object,
        `${gameClass.label} ${fieldLabel} "${unknownValue}" is not one of its values; it shows as a plain box`,
      ),
    ];
  }

  /**
   * Returns one issue per entry of an enum list field of one class that the
   * field does not list.
   *
   * @param object Scene object.
   * @param gameClass Component class.
   * @param components Component overrides of the object.
   * @returns Warnings naming the field and the value, in field and list order.
   */
  private enumListIssuesCollect(
    object: THREE.Object3D,
    gameClass: GameEntityClass,
    components: GameEntityComponents,
  ): Issue[] {
    return GameEntityComponentResolver.fieldsLeaf(gameClass.fields)
      .filter((field) => field.kind === 'enum_list')
      .flatMap((field) =>
        GameEntityComponentValueList.variantsUnknown(
          field,
          GameEntityComponentValueList.variantsEffective(components, gameClass.type_path, field),
        ).map((value) =>
          this.warningCreate(object, `${gameClass.label} ${field.label} "${value}" is not one of its values`),
        ),
      );
  }

  /**
   * Creates a warning about one object.
   *
   * @param object Scene object.
   * @param description Sentence naming the class, field and value.
   * @returns Warning issue.
   */
  private warningCreate(object: THREE.Object3D, description: string): Issue {
    return this.issueCreate({ severity: 'warning', objectUuid: object.uuid, objectName: object.name, description });
  }
}
