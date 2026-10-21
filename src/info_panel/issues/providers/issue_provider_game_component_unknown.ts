import type * as THREE from 'three';
import type { Issue } from '@/info_panel/issues/issue.js';
import { IssueProvider } from '@/info_panel/issues/issue_provider.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';

/** Identifier of the unknown game component check. */
export const ISSUE_PROVIDER_GAME_COMPONENT_UNKNOWN_ID = 'game_component_unknown';

/**
 * Reports game components whose class the editor does not know from the game,
 * the open document or the built-in classes.
 */
export class IssueProviderGameComponentUnknown extends IssueProvider {
  /** Creates the provider. */
  constructor() {
    super(ISSUE_PROVIDER_GAME_COMPONENT_UNKNOWN_ID, 'Unknown game components');
  }

  /** @inheritdoc */
  collect(worldGroup: THREE.Object3D): Issue[] {
    const issues: Issue[] = [];
    worldGroup.traverse((object) => {
      issues.push(...this.objectIssuesCollect(object));
    });
    return issues;
  }

  /**
   * Checks the component classes of one object.
   *
   * @param object Scene object.
   * @returns One issue per unknown component class.
   */
  private objectIssuesCollect(object: THREE.Object3D): Issue[] {
    const typePaths = Object.keys(GameEntityComponentStore.read(object));
    return typePaths
      .filter((typePath) => GameEntityClassRegistry.classFind(typePath) === null)
      .map((typePath) =>
        this.issueCreate({
          severity: 'warning',
          objectUuid: object.uuid,
          objectName: object.name,
          description: `Game component ${typePath} is not a class the game knows`,
        }),
      );
  }
}
