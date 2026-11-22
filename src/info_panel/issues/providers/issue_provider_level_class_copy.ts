import type * as THREE from 'three';
import type { Issue } from '@/info_panel/issues/issue.js';
import { IssueProvider } from '@/info_panel/issues/issue_provider.js';
import { gameEntityClassRenameNormalize } from '@/game_entity/class/game_entity_class_migration_schema.js';
import { GameEntityClassProviderPreview } from '@/game_entity/class/game_entity_class_provider_preview.js';
import { GameEntityClassProviderProject } from '@/game_entity/class/game_entity_class_provider_project.js';
import { GameEntityClassProviderScene } from '@/game_entity/class/game_entity_class_provider_scene.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';

/** Stable id of the level class copy issue provider. */
export const ISSUE_PROVIDER_LEVEL_CLASS_COPY_ID = 'level_class_copy';

/**
 * Compares the copy of the classes the open level carries with the classes of
 * the project's class file or the running game, which always win: a copy that
 * differs is used no more and is refreshed when the level is saved, a copied
 * class another class was renamed from is replaced, and a class only the copy
 * declares is named so it can be moved into the project.
 */
export class IssueProviderLevelClassCopy extends IssueProvider {
  /** Creates the provider. */
  constructor() {
    super(ISSUE_PROVIDER_LEVEL_CLASS_COPY_ID, 'Level class copy');
  }

  /**
   * Collects one warning per copied class that is outdated, replaced or only
   * known from the copy, while a project or game declares classes.
   *
   * @param _worldGroup Scene root.
   * @returns Issues in the copy's class order.
   */
  collect(_worldGroup: THREE.Object3D): Issue[] {
    if (!IssueProviderLevelClassCopy.authorityDeclaresClasses()) {
      return [];
    }
    return GameEntityClassProviderScene.shared
      .listRead()
      .classes.map((copied) => IssueProviderLevelClassCopy.descriptionOf(copied))
      .filter((description): description is string => description !== null)
      .map((description) =>
        this.issueCreate({ severity: 'warning', objectUuid: null, objectName: 'Level', description }),
      );
  }

  /**
   * Returns whether the project's class file or the running game declares any
   * class.
   *
   * @returns True when the level's copy is not the only source.
   */
  private static authorityDeclaresClasses(): boolean {
    const providers = [GameEntityClassProviderProject.shared, GameEntityClassProviderPreview.shared];
    return providers.some((provider) => provider.listRead().classes.length > 0);
  }

  /**
   * Describes how one copied class compares with the class the editor uses.
   *
   * @param copied Class as the level's copy has it.
   * @returns The sentence for the Issues list, or null when the copy matches.
   */
  private static descriptionOf(copied: GameEntityClass): string | null {
    const replacing = IssueProviderLevelClassCopy.renamedInto(copied.type_path);
    if (replacing !== null) {
      return `The level's copy of class ${copied.label} is replaced by ${replacing.label}, renamed from it in the project's class file`;
    }
    const used = GameEntityClassRegistry.classFind(copied.type_path);
    if (used === copied) {
      return `The level carries class ${copied.label} that the project's class file does not declare; File > Move Level Classes to Project adds it`;
    }
    if (used === null || JSON.stringify(used) === JSON.stringify(copied)) {
      return null;
    }
    return `The level's copy of class ${copied.label} differs from the project's class file; the project's class is used, and the copy is refreshed when you save`;
  }

  /**
   * Returns the class renamed from a type path.
   *
   * @param typePath Old type path.
   * @returns The class that lists the type path among its old names, or null.
   */
  private static renamedInto(typePath: string): GameEntityClass | null {
    return (
      GameEntityClassRegistry.classesList().find((gameClass) =>
        (gameClass.renamed_from ?? []).some((rename) => gameEntityClassRenameNormalize(rename).type_path === typePath),
      ) ?? null
    );
  }
}
