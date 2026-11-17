import { addMenuCatalogActionCreate } from '@/layout/setup/add_menu_catalog.js';
import { prefabEditorActionsActive } from '@/prefab/actions/prefab_editor_actions_active.js';
import { getPrefabCatalogStore, type PrefabCatalogStore } from '@/prefab/prefab_catalog_store.js';
import type { PrefabTemplate } from '@/prefab/prefab_types.js';
import { PrefabPreviewBuilder } from '@/prefab/preview/prefab_preview_builder.js';
import { prefabTileMenuEntriesCreate } from '@/prefab/ui/prefab_tile_menu_entries.js';
import type { IconName } from '@/ui/icons/icon_name.js';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';

/** Label of the Add menu section, and the top-level category of prefab tiles. */
export const PREFAB_ADD_MENU_SECTION_LABEL = 'Prefabs';

/** Prefix of the catalog id of every prefab entry. */
export const PREFAB_CATALOG_ID_PREFIX = 'prefab.';

/** Icon of the section and of prefab entries without a 3D preview. */
const PREFAB_ADD_MENU_ICON: IconName = 'puzzle';

/**
 * Builds the Prefabs section of the Add menu: one submenu per prefab category,
 * each listing its prefabs. Choosing one places a copy at the centre of the
 * active view; catalogs such as the entity browser also place it at a drop
 * point, show its 3D preview and offer its right-click menu.
 *
 * @returns Prefabs submenu whose entries are read when it opens.
 */
export function prefabAddMenuSection(): ToolbarMenuEntry {
  return {
    kind: 'submenu',
    label: PREFAB_ADD_MENU_SECTION_LABEL,
    icon: PREFAB_ADD_MENU_ICON,
    children: [],
    childrenResolve: () => prefabAddMenuEntries(getPrefabCatalogStore()),
  };
}

/**
 * Builds one submenu per prefab category in first-seen order.
 *
 * @param store Prefab catalog.
 * @returns Category submenus.
 */
export function prefabAddMenuEntries(store: PrefabCatalogStore): ToolbarMenuEntry[] {
  const byCategory = new Map<string, PrefabTemplate[]>();
  for (const template of store.templatesRead()) {
    const members = byCategory.get(template.category) ?? [];
    members.push(template);
    byCategory.set(template.category, members);
  }
  return [...byCategory].map(([category, templates]) => ({
    kind: 'submenu',
    label: category,
    children: templates.map((template) => prefabAddMenuTemplateEntry(template)),
  }));
}

/**
 * Returns the catalog id of a prefab.
 *
 * @param templateId Prefab id.
 * @returns Catalog id.
 */
export function prefabCatalogIdOf(templateId: string): string {
  return `${PREFAB_CATALOG_ID_PREFIX}${templateId}`;
}

/**
 * Builds the entry of one prefab.
 *
 * @param template Prefab.
 * @returns Add menu action with catalog information.
 */
function prefabAddMenuTemplateEntry(template: PrefabTemplate): ToolbarMenuEntry {
  return addMenuCatalogActionCreate(
    {
      label: template.name,
      icon: PREFAB_ADD_MENU_ICON,
      tooltip: `Prefab in ${template.category}`,
      onClick: () => prefabEditorActionsActive.read()?.placeAtViewCentre(template.id),
    },
    {
      id: prefabCatalogIdOf(template.id),
      previewCreate: () => PrefabPreviewBuilder.previewCreate(template.payload),
      placeAtAim: (aim) => prefabEditorActionsActive.read()?.placeAtAim(template.id, aim),
      contextEntriesCreate: () => prefabTileMenuEntriesCreate(template.id),
    },
  );
}
