import * as THREE from 'three';
import { UndoCommand } from '@/commands/command_undo.js';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import { GameEntityLogicMatcher } from '@/game_entity/logic/game_entity_logic_matcher.js';
import type { AuthoredLogicOutput } from '@/game_entity/logic/game_entity_logic_types.js';

/** Saved logic output rows on one object modified during rename target sync. */
interface LogicRowsBackup {
  /** Scene object whose logic rows were rewritten. */
  readonly object: THREE.Object3D;
  /** Original rows prior to rename. */
  readonly rows: AuthoredLogicOutput[];
}

/**
 * Undoable command for renaming a Three.js object and updating exact-match
 * Entity I/O target references in the same scene hierarchy.
 */
export class CommandObjectRename implements UndoCommand {
  private readonly object: THREE.Object3D;
  private readonly newName: string;
  private readonly previousName: string;
  private syncedBackups: LogicRowsBackup[];

  /**
   * Creates a new rename command for the specified object.
   *
   * @param object The Three.js object to rename.
   * @param newName The new name to assign to the object.
   */
  constructor(object: THREE.Object3D, newName: string) {
    this.object = object;
    this.newName = newName;
    this.previousName = object.name;
    this.syncedBackups = [];
  }

  /**
   * Executes the rename and updates matching Entity I/O targets in the
   * hierarchy.
   */
  execute(): void {
    const result = GameEntityLogicMatcher.renameTargetsSyncWithBackups(
      this.hierarchyRootResolve(),
      this.previousName,
      this.newName,
    );
    this.syncedBackups = result.backups;
    this.object.name = this.newName;
  }

  /** Undoes the rename and restores previous Entity I/O target names. */
  undo(): void {
    this.object.name = this.previousName;
    this.syncedBackups.forEach((backup) => GameEntityLogicStore.write(backup.object, backup.rows));
  }

  /**
   * Walks parent links to find the topmost hierarchy root above the renamed
   * object.
   *
   * @returns Root Object3D.
   */
  private hierarchyRootResolve(): THREE.Object3D {
    let root: THREE.Object3D = this.object;
    while (root.parent) {
      root = root.parent;
    }
    return root;
  }
}
