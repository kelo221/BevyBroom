import type * as THREE from 'three';
import { issueCreate, type Issue, type IssueFields } from '@/info_panel/issues/issue.js';

/**
 * Base of the checks that find problems in the open map. Each provider looks at
 * the world and reports the issues of one kind.
 */
export abstract class IssueProvider {
  /** Stable identifier of the provider. */
  readonly id: string;
  /** Display name of the check. */
  readonly label: string;

  /**
   * Creates a provider.
   *
   * @param id Stable identifier.
   * @param label Display name of the check.
   */
  protected constructor(id: string, label: string) {
    this.id = id;
    this.label = label;
  }

  /**
   * Finds the problems of this provider's kind under the world.
   *
   * @param worldGroup Editor world root.
   * @returns Issues found, in scene order.
   */
  abstract collect(worldGroup: THREE.Object3D): Issue[];

  /**
   * Creates an issue reported by this provider.
   *
   * @param fields What is reported.
   * @returns The issue.
   */
  protected issueCreate(fields: IssueFields): Issue {
    return issueCreate(this.id, fields);
  }
}
