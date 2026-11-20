import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import { COLLISION_KINDS, type CollisionKind } from '@/level_export/collision/collision_types.js';
import { CollisionKindStore } from '@/level_export/kind/collision_kind_store.js';
import { CommandCollisionKindSet } from '@/level_export/kind/command_collision_kind_set.js';
import { LevelExportObjectFilter } from '@/level_export/level_export_object_filter.js';
import { CommandSolidBrushGameComponentsDetach } from '@/solid/commands/brush/command_solid_brush_game_components_detach.js';
import { findSolidModelRoot } from '@/solid/model/solid_group.js';
import { InputSelect, type InputSelectChoice } from '@/ui/input/input_select.js';
import type { PanelPropertiesSection, PanelPropertiesSectionChrome } from '@/ui/properties/panel_properties_section.js';
import { panelPropertiesRowCreate } from '@/ui/properties/panel_properties_row.js';

/** Select value of objects that take the kind their classes declare. */
const PANEL_PROPERTIES_COLLISION_DECLARED = 'declared';

/** Captions of the collision kinds. */
const PANEL_PROPERTIES_COLLISION_LABELS: Readonly<Record<CollisionKind, string>> = {
  solid: 'Solid',
  volume: 'Volume (not drawn)',
  none: 'None (drawn only)',
};

/**
 * Inspector section that shows how the game collides with the selected brush
 * entities and plain meshes and lets them override the kind their game classes
 * declare.
 */
export class PanelPropertiesCollisionSection implements PanelPropertiesSection {
  private readonly section: HTMLElement;
  private readonly select: InputSelect;
  private boundRoots: THREE.Object3D[] = [];
  private commandStack: CommandStack | null = null;

  /**
   * Creates the section.
   *
   * @param chrome Element factories of the hosting panel.
   */
  constructor(chrome: PanelPropertiesSectionChrome) {
    this.section = chrome.createSectionContainer();
    this.section.style.display = 'none';
    this.section.appendChild(chrome.createSectionHeader('Collision'));
    this.select = new InputSelect([], 'Collision kind');
    this.select.bindCommit(() => this.kindCommit());
    this.section.appendChild(panelPropertiesRowCreate('Kind', this.select));
  }

  /**
   * Returns the section element.
   *
   * @returns Section root.
   */
  getElement(): HTMLElement {
    return this.section;
  }

  /**
   * Sets the undo stack used by edits.
   *
   * @param stack Command stack, or null to apply edits without history.
   */
  setCommandStack(stack: CommandStack | null): void {
    this.commandStack = stack;
  }

  /**
   * Shows the section when every selected object is a solid model, a brush of
   * one or a plain content mesh, and fills it from those objects.
   *
   * @param objects Current inspector selection.
   */
  updateFromObjects(objects: readonly THREE.Object3D[]): void {
    const roots = objects.map((object) => PanelPropertiesCollisionSection.collisionObjectOf(object));
    const isShown = roots.length > 0 && roots.every((root) => root !== null);
    this.boundRoots = isShown ? [...new Set(roots.filter((root): root is THREE.Object3D => root !== null))] : [];
    this.section.style.display = isShown ? 'block' : 'none';
    if (isShown) {
      this.fieldWrite();
    }
  }

  /**
   * Returns the object whose collision kind a selected object edits.
   *
   * @param object Selected object.
   * @returns The object itself when it is a brush with game components or a
   *   plain content mesh, else its solid model, or null.
   */
  private static collisionObjectOf(object: THREE.Object3D): THREE.Object3D | null {
    if (CommandSolidBrushGameComponentsDetach.brushWithComponentsIs(object)) {
      return object;
    }
    return findSolidModelRoot(object) ?? (LevelExportObjectFilter.contentMeshIs(object) ? object : null);
  }

  /** Fills the choices and shows the shared value of the bound objects. */
  private fieldWrite(): void {
    const first = this.boundRoots[0];
    const declared = (first ? CollisionKindStore.declaredRead(first) : null) ?? 'solid';
    const choices: InputSelectChoice[] = [
      {
        value: PANEL_PROPERTIES_COLLISION_DECLARED,
        label: `From class (${PANEL_PROPERTIES_COLLISION_LABELS[declared]})`,
      },
      ...COLLISION_KINDS.map((kind) => ({ value: kind, label: PANEL_PROPERTIES_COLLISION_LABELS[kind] })),
    ];
    this.select.setChoices(choices);
    this.select.setSharedValues(
      this.boundRoots.map((root) => CollisionKindStore.overrideRead(root) ?? PANEL_PROPERTIES_COLLISION_DECLARED),
    );
  }

  /** Applies the chosen kind to every bound object as one undo step. */
  private kindCommit(): void {
    const kind = CollisionKindStore.fromUnknown(this.select.getValue());
    const command = new CommandCollisionKindSet(this.boundRoots, kind);
    if (!command.hasChanges()) {
      return;
    }
    if (this.commandStack) {
      this.commandStack.push(command);
    } else {
      command.execute();
    }
    this.fieldWrite();
  }
}
