import { describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import type { AddMenuActions } from '@/layout/setup/add_menu_entries.js';
import { AddMenuSectionRegistry } from '@/layout/setup/add_menu_section_registry.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import { proceduralAddMenuSection } from '@/procedural/ui/procedural_add_menu_section.js';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';

/**
 * Returns Add menu callbacks that only record placed entities.
 *
 * @param placed Receives every placed owner.
 * @returns Callbacks.
 */
function actionsCreate(placed: THREE.Group[]): AddMenuActions {
  const ignore = vi.fn();
  return new Proxy({} as AddMenuActions, {
    get: (_target, property) =>
      property === 'onAddEntityPlaced' ? (factory: () => THREE.Group) => placed.push(factory()) : ignore,
  });
}

/**
 * Returns the resolved children of a submenu.
 *
 * @param entry Menu entry.
 * @returns Its children.
 */
function childrenOf(entry: ToolbarMenuEntry): ToolbarMenuEntry[] {
  if (entry.kind !== 'submenu') {
    throw new Error('not a submenu');
  }
  return entry.childrenResolve ? entry.childrenResolve() : entry.children;
}

/** The Add menu places one procedural object per generator. */
describe('proceduralAddMenuSection', () => {
  it('is one of the Add menu sections', () => {
    const labels = AddMenuSectionRegistry.entriesCreate(actionsCreate([])).map((entry) =>
      entry.kind === 'submenu' ? entry.label : '',
    );
    expect(labels).toContain('Procedural');
  });

  it('lists every generator and places an object built by it', () => {
    const placed: THREE.Group[] = [];
    const entries = childrenOf(proceduralAddMenuSection(actionsCreate(placed)));
    const generators = ProceduralGeneratorRegistry.list();
    expect(entries.map((entry) => ('onClick' in entry ? entry.label : ''))).toEqual(
      generators.map((generator) => generator.label),
    );
    entries.forEach((entry) => ('onClick' in entry ? entry.onClick() : undefined));
    expect(placed.map((owner) => ProceduralOwner.settingsRead(owner)?.generatorId)).toEqual(
      generators.map((generator) => generator.generatorId),
    );
  });
});
