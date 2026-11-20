import type * as THREE from 'three';
import type { Issue } from '@/info_panel/issues/issue.js';
import { IssueProvider } from '@/info_panel/issues/issue_provider.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { CollisionKindStore } from '@/level_export/kind/collision_kind_store.js';

/** Identifier of the trigger box without a purpose check. */
export const ISSUE_PROVIDER_COLLISION_VOLUME_UNDECLARED_ID = 'collision_volume_undeclared';

/**
 * Warns about objects set to a trigger box (Collision: Volume) while none of
 * their game components declares a volume, because the game leaves such objects
 * out. A warning, since errors block Build Level.
 */
export class IssueProviderCollisionVolumeUndeclared extends IssueProvider {
  /** Creates the provider. */
  constructor() {
    super(ISSUE_PROVIDER_COLLISION_VOLUME_UNDECLARED_ID, 'Trigger boxes without a purpose');
  }

  /** @inheritdoc */
  collect(worldGroup: THREE.Object3D): Issue[] {
    const issues: Issue[] = [];
    worldGroup.traverse((object) => {
      if (IssueProviderCollisionVolumeUndeclared.triggerBoxWithoutPurposeIs(object)) {
        issues.push(this.objectIssueCreate(object));
      }
    });
    return issues;
  }

  /**
   * Returns whether an object resolves to a volume without any of its game
   * components declaring one.
   *
   * @param object Scene object.
   * @returns True when the game would leave the object out.
   */
  private static triggerBoxWithoutPurposeIs(object: THREE.Object3D): boolean {
    return CollisionKindStore.resolve(object) === 'volume' && CollisionKindStore.declaredRead(object) !== 'volume';
  }

  /**
   * Lists the labels of the loaded classes that declare a volume.
   *
   * @returns Labels in registry order.
   */
  private static volumeClassLabelsList(): string[] {
    return GameEntityClassRegistry.classesList()
      .filter((gameClass) => gameClass.collision === 'volume')
      .map((gameClass) => gameClass.label);
  }

  /**
   * Words the advice for fixing the object, naming the components that make an
   * object a trigger box.
   *
   * @returns Sentence ending the description.
   */
  private static remedyText(): string {
    const labels = IssueProviderCollisionVolumeUndeclared.volumeClassLabelsList();
    const component = labels.length === 0 ? 'a component that makes it a trigger box' : `one of: ${labels.join(', ')}`;
    return `Set Collision back to "From class" or add ${component}.`;
  }

  /**
   * Builds the warning of one object.
   *
   * @param object Trigger box without a purpose.
   * @returns Warning issue.
   */
  private objectIssueCreate(object: THREE.Object3D): Issue {
    const remedy = IssueProviderCollisionVolumeUndeclared.remedyText();
    return this.issueCreate({
      severity: 'warning',
      objectUuid: object.uuid,
      objectName: object.name,
      description: `${object.name} is set to Trigger box (Collision: Volume) but has no component that makes it a trigger box, so the game leaves it out. ${remedy}`,
    });
  }
}
