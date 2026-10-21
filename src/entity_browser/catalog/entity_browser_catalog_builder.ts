import { addMenuCatalogInfoRead, type AddMenuCatalogObjectMatcher } from '@/layout/setup/add_menu_catalog.js';
import type { AddMenuActions } from '@/layout/setup/add_menu_entries.js';
import { AddMenuSectionRegistry } from '@/layout/setup/add_menu_section_registry.js';
import { isMenuAction, isMenuSubmenu, type ToolbarMenuAction, type ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';

/** Category of Add menu actions placed directly at the top level. */
export const ENTITY_BROWSER_CATALOG_CATEGORY_GENERAL = 'General';

/** Separator between nested submenu labels in a category path. */
export const ENTITY_BROWSER_CATALOG_CATEGORY_SEPARATOR = ' / ';

/**
 * Builds the entity browser catalog from the Add menu section registry: every
 * action of every section, nested submenus included, becomes one entry.
 */
export class EntityBrowserCatalogBuilder {
  private readonly entries: EntityBrowserCatalogEntry[] = [];
  private readonly categoryIndices = new Map<string, number>();
  private readonly entryIds = new Set<string>();

  /**
   * Builds the catalog of the Add menu as it currently is.
   *
   * @param actions Creation callbacks the Add menu entries call.
   * @returns Entries in Add menu order.
   */
  static catalogBuild(actions: AddMenuActions): EntityBrowserCatalogEntry[] {
    const builder = new EntityBrowserCatalogBuilder();
    builder.menuEntriesVisit(AddMenuSectionRegistry.entriesCreate(actions), []);
    return builder.entries;
  }

  /**
   * Visits menu entries, descending into submenus.
   *
   * @param menuEntries Entries of one menu level.
   * @param categoryPath Labels of the submenus leading to this level.
   */
  private menuEntriesVisit(menuEntries: readonly ToolbarMenuEntry[], categoryPath: readonly string[]): void {
    for (const menuEntry of menuEntries) {
      if (isMenuSubmenu(menuEntry)) {
        const children = menuEntry.childrenResolve?.() ?? menuEntry.children;
        this.menuEntriesVisit(children, [...categoryPath, menuEntry.label]);
      } else if (isMenuAction(menuEntry)) {
        this.menuActionAdd(menuEntry, categoryPath);
      }
    }
  }

  /**
   * Adds one menu action as a catalog entry unless its id is already listed.
   *
   * @param action Menu action.
   * @param categoryPath Labels of the submenus leading to the action.
   */
  private menuActionAdd(action: ToolbarMenuAction, categoryPath: readonly string[]): void {
    const catalogInfo = addMenuCatalogInfoRead(action);
    const id = catalogInfo?.id ?? EntityBrowserCatalogBuilder.entryIdDerive(categoryPath, action.label);
    if (this.entryIds.has(id)) {
      return;
    }
    this.entryIds.add(id);
    this.entries.push(this.entryCreate(action, id, categoryPath, catalogInfo?.objectMatches ?? null));
  }

  /**
   * Creates the catalog entry of one menu action.
   *
   * @param action Menu action.
   * @param id Entry id.
   * @param categoryPath Labels of the submenus leading to the action.
   * @param objectMatches Usage matcher, or null when usage is unknown.
   * @returns Catalog entry.
   */
  private entryCreate(
    action: ToolbarMenuAction,
    id: string,
    categoryPath: readonly string[],
    objectMatches: AddMenuCatalogObjectMatcher | null,
  ): EntityBrowserCatalogEntry {
    const category = EntityBrowserCatalogBuilder.categoryJoin(categoryPath);
    return {
      id,
      label: action.label,
      category,
      categoryIndex: this.categoryIndexResolve(category),
      catalogIndex: this.entries.length,
      iconName: action.icon ?? null,
      iconColor: action.iconColor ?? null,
      tooltip: EntityBrowserCatalogBuilder.tooltipResolve(action),
      objectMatches,
      activate: () => EntityBrowserCatalogBuilder.actionActivate(action),
    };
  }

  /**
   * Returns the order of a category, assigning the next one on first sight.
   *
   * @param category Category path.
   * @returns Category position in Add menu order.
   */
  private categoryIndexResolve(category: string): number {
    const known = this.categoryIndices.get(category);
    if (known !== undefined) {
      return known;
    }
    const assigned = this.categoryIndices.size;
    this.categoryIndices.set(category, assigned);
    return assigned;
  }

  /**
   * Joins submenu labels into a category path.
   *
   * @param categoryPath Submenu labels.
   * @returns Category path, or the general category at the top level.
   */
  private static categoryJoin(categoryPath: readonly string[]): string {
    if (categoryPath.length === 0) {
      return ENTITY_BROWSER_CATALOG_CATEGORY_GENERAL;
    }
    return categoryPath.join(ENTITY_BROWSER_CATALOG_CATEGORY_SEPARATOR);
  }

  /**
   * Derives an id for an action that carries no catalog information.
   *
   * @param categoryPath Submenu labels leading to the action.
   * @param label Action label.
   * @returns Id made of the lowercase labels.
   */
  private static entryIdDerive(categoryPath: readonly string[], label: string): string {
    const parts = [...categoryPath, label].map((part) => part.trim().toLowerCase().replace(/\s+/g, '_'));
    return `menu.${parts.join('.')}`;
  }

  /**
   * Resolves the current tooltip text of an action.
   *
   * @param action Menu action.
   * @returns Tooltip, or empty when none.
   */
  private static tooltipResolve(action: ToolbarMenuAction): string {
    const tooltip = typeof action.tooltip === 'function' ? action.tooltip() : action.tooltip;
    return tooltip ?? '';
  }

  /**
   * Runs an action unless its live enablement check says it is disabled.
   *
   * @param action Menu action.
   */
  private static actionActivate(action: ToolbarMenuAction): void {
    if (action.isEnabled?.() === false) {
      return;
    }
    action.onClick();
  }
}
