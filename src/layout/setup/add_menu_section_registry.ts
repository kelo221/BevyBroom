import type { ToolbarMenuEntry } from '@/ui/toolbar/toolbar.js';
import type { AddMenuActions } from '@/layout/setup/add_menu_entries.js';
import { addMenuSectionsBuiltin } from '@/layout/setup/add_menu_section_builtin.js';
import { RegistryExtensible } from '@/utils/registry/registry_extensible.js';

/** Builds one top-level Add menu entry from the editor's creation callbacks. */
export type AddMenuSectionFactory = (actions: AddMenuActions) => ToolbarMenuEntry;

/**
 * Lists the top-level sections of the Add menu: the built-in categories
 * followed by sections features register. Register before the menu is built.
 */
export class AddMenuSectionRegistry {
  private static readonly factories = new RegistryExtensible<AddMenuSectionFactory>(addMenuSectionsBuiltin);

  /**
   * Adds a section after the built-in ones.
   *
   * @param factory Section factory.
   */
  static register(factory: AddMenuSectionFactory): void {
    AddMenuSectionRegistry.factories.register(factory);
  }

  /**
   * Removes a section added with {@link register}.
   *
   * @param factory Section factory.
   */
  static unregister(factory: AddMenuSectionFactory): void {
    AddMenuSectionRegistry.factories.unregister(factory);
  }

  /**
   * Builds the entry of every section.
   *
   * @param actions Creation callbacks.
   * @returns Top-level Add menu entries in display order.
   */
  static entriesCreate(actions: AddMenuActions): ToolbarMenuEntry[] {
    return AddMenuSectionRegistry.factories.list().map((factory) => factory(actions));
  }
}
