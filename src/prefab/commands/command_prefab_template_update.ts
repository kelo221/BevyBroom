import type { UndoCommand } from '@/commands/command_undo.js';
import type { PrefabCatalogStore } from '@/prefab/prefab_catalog_store.js';
import type { PrefabTemplate } from '@/prefab/prefab_types.js';

/**
 * Undoable change of one prefab template's name or category. Execute stores the
 * changed template under the same id; undo stores the previous one again.
 */
export class CommandPrefabTemplateUpdate implements UndoCommand {
  private readonly store: PrefabCatalogStore;
  private readonly before: PrefabTemplate;
  private readonly after: PrefabTemplate;

  /**
   * Creates the template change.
   *
   * @param store Prefab catalog holding the template.
   * @param before Template as it is now.
   * @param after Template as it becomes; must keep the id of `before`.
   */
  constructor(store: PrefabCatalogStore, before: PrefabTemplate, after: PrefabTemplate) {
    this.store = store;
    this.before = before;
    this.after = after;
  }

  /** Stores the changed template. */
  execute(): void {
    this.store.templateAdd(this.after);
  }

  /** Stores the previous template again. */
  undo(): void {
    this.store.templateAdd(this.before);
  }
}
