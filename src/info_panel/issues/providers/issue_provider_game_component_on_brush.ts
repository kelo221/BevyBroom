import type * as THREE from 'three';
import type { Issue } from '@/info_panel/issues/issue.js';
import { IssueProvider } from '@/info_panel/issues/issue_provider.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { SolidModel } from '@/solid/model/solid_model.js';

/** Identifier of the check for game components the game never receives. */
export const ISSUE_PROVIDER_GAME_COMPONENT_ON_BRUSH_ID = 'game_component_on_brush';

/**
 * Reports game components stored on objects inside a solid model. Brushes are
 * compiled into one mesh, so the game has no object to give those components
 * to; they belong on the solid model itself or on a game entity.
 */
export class IssueProviderGameComponentOnBrush extends IssueProvider {
  /** Creates the provider. */
  constructor() {
    super(ISSUE_PROVIDER_GAME_COMPONENT_ON_BRUSH_ID, 'Game components on brushes');
  }

  /** @inheritdoc */
  collect(worldGroup: THREE.Object3D): Issue[] {
    const issues: Issue[] = [];
    worldGroup.traverse((object) => {
      if (this.componentsInsideSolidModelAre(object)) {
        issues.push(this.objectIssueCreate(object));
      }
    });
    return issues;
  }

  /**
   * Returns whether an object below a solid model root carries game components.
   *
   * @param object Scene object.
   * @returns True when its components cannot reach the game.
   */
  private componentsInsideSolidModelAre(object: THREE.Object3D): boolean {
    const model = SolidModel.fromObject(object);
    if (!model || model.root === object) {
      return false;
    }
    return Object.keys(GameEntityComponentStore.read(object)).length > 0;
  }

  /**
   * Builds the issue of one object.
   *
   * @param object Object inside a solid model with components.
   * @returns Error issue.
   */
  private objectIssueCreate(object: THREE.Object3D): Issue {
    return this.issueCreate({
      severity: 'error',
      objectUuid: object.uuid,
      objectName: object.name,
      description: 'Game components on a brush never reach the game; move them to the solid model or to a game entity',
    });
  }
}
