import type * as THREE from 'three';
import { VisGroupObjectCollector } from '@/visgroup/visgroup_object_collector.js';
import { GameEntityLogicStore } from './game_entity_logic_store.js';
import type {
  AuthoredLogicOutput,
  LogicIncomingConnection,
  LogicTargetValidationStatus,
} from './game_entity_logic_types.js';

/**
 * Resolves entity I/O target names (exact names, `*` and `?` wildcards, and
 * `!self`), validates connection rows, builds reverse input tables, and syncs
 * target names when objects are renamed.
 */
export class GameEntityLogicMatcher {
  /**
   * Tests whether a candidate object name matches a target pattern (`*` and `?`
   * wildcards supported).
   *
   * @param pattern Target name pattern.
   * @param candidateName Scene object name.
   * @returns True when the candidate matches the pattern.
   */
  static nameMatchesPattern(pattern: string, candidateName: string): boolean {
    const trimmed = pattern.trim();
    if (!trimmed || !candidateName) {
      return false;
    }
    if (!trimmed.includes('*') && !trimmed.includes('?')) {
      return trimmed === candidateName;
    }
    const escaped = trimmed.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const regexSource = `^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`;
    return new RegExp(regexSource).test(candidateName);
  }

  /**
   * Resolves all scene objects under worldRoot matched by a target string from
   * a given source object.
   *
   * @param sourceObject Object emitting the output.
   * @param targetPattern Target name, wildcard, or `!self`.
   * @param worldRoot Scene world root.
   * @returns Matching scene objects.
   */
  static targetsResolve(
    sourceObject: THREE.Object3D,
    targetPattern: string,
    worldRoot: THREE.Object3D,
  ): THREE.Object3D[] {
    const trimmed = targetPattern.trim();
    if (!trimmed) {
      return [];
    }
    if (trimmed === '!self') {
      return [sourceObject];
    }
    return VisGroupObjectCollector.descendantsCollect(worldRoot).filter((candidate) =>
      GameEntityLogicMatcher.nameMatchesPattern(trimmed, candidate.name),
    );
  }

  /**
   * Returns the names a target may use: `!self` and every distinct object name
   * under worldRoot, sorted.
   *
   * @param worldRoot Scene world root.
   * @returns Target names.
   */
  static targetNamesList(worldRoot: THREE.Object3D): string[] {
    const names = new Set<string>();
    VisGroupObjectCollector.descendantsCollect(worldRoot).forEach((candidate) => {
      if (candidate.name.trim() !== '') {
        names.add(candidate.name);
      }
    });
    return ['!self', ...[...names].sort()];
  }

  /**
   * Evaluates the Hammer++ validation status of a target pattern.
   *
   * @param sourceObject Source object.
   * @param targetPattern Target pattern string.
   * @param worldRoot Scene world root.
   * @returns `'broken'` (0 matches), `'valid_single'` (1), or
   *   `'valid_multiple'` (>1).
   */
  static targetValidate(
    sourceObject: THREE.Object3D,
    targetPattern: string,
    worldRoot: THREE.Object3D,
  ): LogicTargetValidationStatus {
    const matches = GameEntityLogicMatcher.targetsResolve(sourceObject, targetPattern, worldRoot);
    if (matches.length === 0) {
      return 'broken';
    }
    return matches.length === 1 ? 'valid_single' : 'valid_multiple';
  }

  /**
   * Collects all incoming connections across worldRoot that resolve to
   * targetObject for the read-only Hammer++ Inputs tab.
   *
   * @param targetObject Object being inspected.
   * @param worldRoot Scene world root.
   * @returns Incoming connections targeting targetObject.
   */
  static incomingConnectionsCollect(
    targetObject: THREE.Object3D,
    worldRoot: THREE.Object3D,
  ): LogicIncomingConnection[] {
    const incoming: LogicIncomingConnection[] = [];
    VisGroupObjectCollector.descendantsCollect(worldRoot).forEach((sourceObject) => {
      GameEntityLogicStore.read(sourceObject).forEach((row, rowIndex) => {
        const resolved = GameEntityLogicMatcher.targetsResolve(sourceObject, row.target, worldRoot);
        if (resolved.includes(targetObject)) {
          incoming.push({ sourceObject, sourceName: sourceObject.name || sourceObject.uuid, rowIndex, row });
        }
      });
    });
    return incoming;
  }

  /**
   * Updates all exact-match `target === oldName` output rows under worldRoot to
   * `newName` when an object is renamed.
   *
   * @param worldRoot Scene world root.
   * @param oldName Previous object name.
   * @param newName New object name.
   * @returns Number of output rows updated.
   */
  static renameTargetsSync(worldRoot: THREE.Object3D, oldName: string, newName: string): number {
    return GameEntityLogicMatcher.renameTargetsSyncWithBackups(worldRoot, oldName, newName).updatedCount;
  }

  /**
   * Rewrites exact-match output target references across a hierarchy and
   * returns backups of every modified object for undo restoration.
   *
   * @param worldRoot Scene or hierarchy root.
   * @param oldName Previous object name.
   * @param newName New object name.
   * @returns Count of updated rows and pre-change row backups.
   */
  static renameTargetsSyncWithBackups(
    worldRoot: THREE.Object3D,
    oldName: string,
    newName: string,
  ): {
    updatedCount: number;
    backups: Array<{ object: THREE.Object3D; rows: AuthoredLogicOutput[] }>;
  } {
    const fromName = oldName.trim();
    const toName = newName.trim();
    if (!fromName || !toName || fromName === toName) {
      return { updatedCount: 0, backups: [] };
    }
    const backups: Array<{ object: THREE.Object3D; rows: AuthoredLogicOutput[] }> = [];
    let updatedCount = 0;
    worldRoot.traverse((object) => {
      updatedCount += GameEntityLogicMatcher.objectRenameTargetsSync(object, fromName, toName, backups);
    });
    return { updatedCount, backups };
  }

  /**
   * Updates exact-match target rows on a single object and appends a backup if
   * changed.
   *
   * @param object Scene object holding output rows.
   * @param fromName Old target name.
   * @param toName New target name.
   * @param backups Backup list to append to when modified.
   * @returns Number of updated rows on this object.
   */
  private static objectRenameTargetsSync(
    object: THREE.Object3D,
    fromName: string,
    toName: string,
    backups: Array<{ object: THREE.Object3D; rows: AuthoredLogicOutput[] }>,
  ): number {
    const rows = GameEntityLogicStore.read(object);
    if (!rows.some((row) => row.target === fromName)) {
      return 0;
    }
    backups.push({ object, rows });
    let count = 0;
    const next = rows.map((row) => {
      if (row.target === fromName) {
        count++;
        return { ...row, target: toName };
      }
      return row;
    });
    GameEntityLogicStore.write(object, next);
    return count;
  }
}
