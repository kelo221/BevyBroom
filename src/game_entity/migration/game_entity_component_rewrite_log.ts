import type * as THREE from 'three';
import type { GameEntityComponentRewrite } from '@/game_entity/migration/game_entity_component_normalizer.js';

/** One change made to an object's components, as the Issues list shows it. */
export interface GameEntityComponentRewriteEntry {
  readonly objectUuid: string;
  readonly objectName: string;
  readonly rewrite: GameEntityComponentRewrite;
}

/**
 * Remembers the changes made to objects' components since the open level was
 * loaded, so the Issues list can name each one.
 */
export class GameEntityComponentRewriteLog {
  private static entries: GameEntityComponentRewriteEntry[] = [];

  /** Forgets every change, as when another level is loaded. */
  static clear(): void {
    GameEntityComponentRewriteLog.entries = [];
  }

  /**
   * Remembers the changes made to one object.
   *
   * @param object Object whose components changed.
   * @param rewrites Changes made.
   */
  static record(object: THREE.Object3D, rewrites: readonly GameEntityComponentRewrite[]): void {
    for (const rewrite of rewrites) {
      GameEntityComponentRewriteLog.entries.push({ objectUuid: object.uuid, objectName: object.name, rewrite });
    }
  }

  /**
   * Returns every remembered change.
   *
   * @returns Changes in the order they were made.
   */
  static entriesRead(): readonly GameEntityComponentRewriteEntry[] {
    return GameEntityComponentRewriteLog.entries;
  }
}
