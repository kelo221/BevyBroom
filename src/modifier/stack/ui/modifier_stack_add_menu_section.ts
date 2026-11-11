import type * as THREE from 'three';
import type { ToolbarMenuEntry } from '@/ui/toolbar/toolbar.js';
import type { AddMenuActions } from '@/layout/setup/add_menu_entries.js';
import { addMenuCatalogActionCreate, type AddMenuCatalogObjectMatcher } from '@/layout/setup/add_menu_catalog.js';
import type { IconName } from '@/ui/icons/icon_name.js';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';
import { modifierVolumeTemplates, type ModifierVolumeTemplate } from '@/modifier/stack/modifier_volume_templates.js';

/** Icon of the Modifiers submenu and its rows. */
const MODIFIER_STACK_ADD_MENU_ICON: IconName = 'rounded-corner';

/**
 * Builds the Modifiers submenu with one entry per modifier volume template.
 *
 * @param actions Creation callbacks.
 * @returns Modifiers submenu.
 */
export function modifierStackAddMenuSection(actions: AddMenuActions): ToolbarMenuEntry {
  return {
    kind: 'submenu',
    label: 'Modifiers',
    icon: MODIFIER_STACK_ADD_MENU_ICON,
    children: modifierVolumeTemplates.map((template) => modifierStackAddMenuTemplateEntry(actions, template)),
  };
}

/**
 * Builds the entry that creates a modifier volume from one template.
 *
 * @param actions Creation callbacks.
 * @param template Modifier volume template.
 * @returns Menu action with catalog information.
 */
function modifierStackAddMenuTemplateEntry(
  actions: AddMenuActions,
  template: ModifierVolumeTemplate,
): ToolbarMenuEntry {
  return addMenuCatalogActionCreate(
    {
      label: template.label,
      icon: MODIFIER_STACK_ADD_MENU_ICON,
      onClick: () => actions.onAddModifierVolume(template.id),
    },
    { id: `modifiers.${template.id}`, objectMatches: modifierStackAddMenuTemplateMatcher(template) },
  );
}

/**
 * Returns a matcher for modifier volumes whose stack holds exactly the kinds of
 * a template, in the same order.
 *
 * @param template Modifier volume template.
 * @returns Object matcher.
 */
export function modifierStackAddMenuTemplateMatcher(template: ModifierVolumeTemplate): AddMenuCatalogObjectMatcher {
  return (object: THREE.Object3D) => {
    if (!ModifierVolume.isVolume(object)) return false;
    const kinds = ModifierVolume.read(object).modifiers.map((modifier) => modifier.kind);
    return kinds.length === template.kinds.length && kinds.every((kind, index) => kind === template.kinds[index]);
  };
}
