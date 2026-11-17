import type * as THREE from 'three';
import type { AddMenuActions } from '@/layout/setup/add_menu_entries.js';
import { addMenuCatalogActionCreate } from '@/layout/setup/add_menu_catalog.js';
import { PROCEDURAL_POINT_CLASS_PREFIX } from '@/procedural/model/procedural_definition.js';
import type { ProceduralGenerator } from '@/procedural/generator/procedural_generator.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import { ProceduralSettingsRules } from '@/procedural/model/procedural_settings_rules.js';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';

/** Approximate half-extent of a new procedural object, used for wall clearance. */
const PROCEDURAL_PLACEMENT_RADIUS = 0.5;

/**
 * Builds the Procedural submenu: one entry per generator, following the
 * generators registered when the menu opens.
 *
 * @param actions Creation callbacks.
 * @returns Procedural submenu.
 */
export function proceduralAddMenuSection(actions: AddMenuActions): ToolbarMenuEntry {
  return {
    kind: 'submenu',
    label: 'Procedural',
    icon: 'shape-stairs',
    children: [],
    childrenResolve: () =>
      ProceduralGeneratorRegistry.list().map((generator) => proceduralAddMenuEntry(actions, generator)),
  };
}

/**
 * Builds the entry that places an object built by one generator.
 *
 * @param actions Creation callbacks.
 * @param generator Generator of the new object.
 * @returns Menu action with catalog information.
 */
function proceduralAddMenuEntry(actions: AddMenuActions, generator: ProceduralGenerator): ToolbarMenuEntry {
  const create = (): THREE.Group => proceduralOwnerCreate(generator);
  return addMenuCatalogActionCreate(
    {
      label: generator.label,
      icon: generator.iconName,
      onClick: () => actions.onAddEntityPlaced(create, PROCEDURAL_PLACEMENT_RADIUS),
    },
    {
      id: `${PROCEDURAL_POINT_CLASS_PREFIX}${generator.generatorId}`,
      objectMatches: (object) => ProceduralOwner.settingsRead(object)?.generatorId === generator.generatorId,
      previewCreate: create,
    },
  );
}

/**
 * Creates a new procedural object with a generator's defaults.
 *
 * @param generator Generator of the object.
 * @returns New owner group named after the generator.
 */
export function proceduralOwnerCreate(generator: ProceduralGenerator): THREE.Group {
  return ProceduralOwner.create(generator.label, ProceduralSettingsRules.createForGenerator(generator));
}
