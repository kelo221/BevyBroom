import type * as THREE from 'three';
import type { Issue } from '@/info_panel/issues/issue.js';
import { IssueProvider } from '@/info_panel/issues/issue_provider.js';
import { GameEntityComponentRewriteLog } from '@/game_entity/migration/game_entity_component_rewrite_log.js';

/** Stable id of the component rewrite issue provider. */
export const ISSUE_PROVIDER_GAME_COMPONENT_REWRITES_ID = 'game_component_rewrites';

/**
 * Lists every change the editor made to objects' game components since the
 * level was loaded, such as a renamed class or fixture id, or an enum value
 * filled from the class default, one line per change on objects still in the
 * scene.
 */
export class IssueProviderGameComponentRewrites extends IssueProvider {
  /** Creates the provider. */
  constructor() {
    super(ISSUE_PROVIDER_GAME_COMPONENT_REWRITES_ID, 'Rewritten game components');
  }

  /**
   * Collects one warning per remembered change.
   *
   * @param worldGroup Scene root.
   * @returns Issues in the order the changes were made.
   */
  collect(worldGroup: THREE.Object3D): Issue[] {
    return GameEntityComponentRewriteLog.entriesRead()
      .filter((entry) => worldGroup.getObjectByProperty('uuid', entry.objectUuid) !== undefined)
      .map((entry) =>
        this.issueCreate({
          severity: 'warning',
          objectUuid: entry.objectUuid,
          objectName: entry.objectName,
          description: `${entry.rewrite.description}; save the level to keep it`,
        }),
      );
  }
}
