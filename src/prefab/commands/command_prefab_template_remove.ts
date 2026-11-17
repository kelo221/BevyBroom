import type { UndoCommand } from '@/commands/command_undo.js';
import type { PrefabCatalogStore } from '../prefab_catalog_store.js';
import type { PrefabTemplate } from '../prefab_types.js';

/**
 * Undoable removal of one prefab template from a prefab catalog. Undo adds the
 * same template back; redo removes it again.
 */
export class CommandPrefabTemplateRemove implements UndoCommand {
  private readonly store: PrefabCatalogStore;
  private readonly template: PrefabTemplate;

  /**
   * Creates the template removal.
   *
   * @param store Prefab catalog holding the template.
   * @param template Template to remove.
   */
  constructor(store: PrefabCatalogStore, template: PrefabTemplate) {
    this.store = store;
    this.template = template;
  }

  /** Removes the template from the catalog. */
  execute(): void {
    this.store.templateRemove(this.template.id);
  }

  /** Adds the template back to the catalog. */
  undo(): void {
    this.store.templateAdd(this.template);
  }
}
