import type { UndoCommand } from '@/commands/command_undo.js';
import type { PrefabCatalogStore } from '../prefab_catalog_store.js';
import type { PrefabTemplate } from '../prefab_types.js';

/**
 * Undoable addition of one prefab template to a prefab catalog. Undo removes
 * the template again; redo adds the same template back.
 */
export class CommandPrefabTemplateAdd implements UndoCommand {
  private readonly store: PrefabCatalogStore;
  private readonly template: PrefabTemplate;

  /**
   * Creates the template addition.
   *
   * @param store Prefab catalog receiving the template.
   * @param template Template to add.
   */
  constructor(store: PrefabCatalogStore, template: PrefabTemplate) {
    this.store = store;
    this.template = template;
  }

  /**
   * Returns the template this command adds.
   *
   * @returns Added template.
   */
  templateRead(): PrefabTemplate {
    return this.template;
  }

  /** Adds the template to the catalog. */
  execute(): void {
    this.store.templateAdd(this.template);
  }

  /** Removes the template from the catalog. */
  undo(): void {
    this.store.templateRemove(this.template.id);
  }
}
