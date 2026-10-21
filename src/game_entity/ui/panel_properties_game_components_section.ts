import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import { entityVisualPartIs } from '@/entity/model/entity_owner_keys.js';
import { CommandGameEntityComponentsSet } from '@/game_entity/commands/command_game_entity_components_set.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import {
  type GameEntityComponents,
  GameEntityComponentStore,
} from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { GameEntityComponentAddSelect } from '@/game_entity/ui/game_entity_component_add_select.js';
import { GameEntityComponentBlock } from '@/game_entity/ui/game_entity_component_block.js';
import { GameEntityUiChrome } from '@/game_entity/ui/game_entity_ui_chrome.js';
import type { PanelPropertiesSection, PanelPropertiesSectionChrome } from '@/ui/properties/panel_properties_section.js';

/**
 * Inspector section listing the game components of the selection. It shows the
 * components every selected object carries, lets the user add and remove
 * components and edit their fields, and turns each edit into one undoable step
 * for all selected objects.
 */
export class PanelPropertiesGameComponentsSection implements PanelPropertiesSection {
  private readonly section: HTMLElement;
  private readonly body: HTMLElement;
  private boundObjects: THREE.Object3D[] = [];
  private commandStack: CommandStack | null = null;
  private renderedKey = '';

  /**
   * Creates the section and follows class changes while it is shown.
   *
   * @param chrome Section element factories.
   */
  constructor(chrome: PanelPropertiesSectionChrome) {
    this.section = chrome.createSectionContainer();
    this.section.style.display = 'none';
    this.section.appendChild(chrome.createSectionHeader('Game Components'));
    this.body = document.createElement('div');
    this.section.appendChild(this.body);
    GameEntityClassRegistry.changeListenerAdd(() => this.renderIfShown());
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
   * Shows the section for any selection of scene content and fills it.
   *
   * @param objects Current inspector selection.
   */
  updateFromObjects(objects: readonly THREE.Object3D[]): void {
    this.boundObjects = objects.filter((object) => !entityVisualPartIs(object));
    const shown = objects.length > 0 && this.boundObjects.length === objects.length;
    this.section.style.display = shown ? 'block' : 'none';
    if (shown) {
      this.renderIfChanged();
    }
  }

  /** Rebuilds the blocks when the section is visible. */
  private renderIfShown(): void {
    if (this.section.style.display !== 'none') {
      this.render();
    }
  }

  /**
   * Rebuilds the blocks only when the objects, their components or the known
   * classes changed since the last build, so live transform refreshes keep the
   * fields and their focus.
   */
  private renderIfChanged(): void {
    if (this.renderKeyCreate(this.componentsListRead()) !== this.renderedKey) {
      this.render();
    }
  }

  /** Rebuilds the component blocks, the partial notice and the add select. */
  private render(): void {
    const componentsList = this.componentsListRead();
    this.renderedKey = this.renderKeyCreate(componentsList);
    const shared = PanelPropertiesGameComponentsSection.typePathsShared(componentsList);
    const commit = this.commit.bind(this);
    this.body.replaceChildren(
      ...shared.map((typePath) => new GameEntityComponentBlock(typePath, componentsList, commit).getElement()),
    );
    const partialCount = new Set(componentsList.flatMap((components) => Object.keys(components))).size - shared.length;
    if (partialCount > 0) {
      this.body.appendChild(GameEntityUiChrome.noteCreate(`${partialCount} more on part of the selection`));
    }
    const pointsOnly = this.boundObjects.every((object) => GameEntityOwner.isOwner(object));
    this.body.appendChild(new GameEntityComponentAddSelect(shared, pointsOnly, commit).getElement());
  }

  /**
   * Returns the overrides of every bound object.
   *
   * @returns Overrides in selection order.
   */
  private componentsListRead(): GameEntityComponents[] {
    return this.boundObjects.map((object) => GameEntityComponentStore.read(object));
  }

  /**
   * Returns a key that changes with the bound objects, their overrides and the
   * known classes.
   *
   * @param componentsList Overrides of every bound object.
   * @returns Render key.
   */
  private renderKeyCreate(componentsList: readonly GameEntityComponents[]): string {
    const identifiers = this.boundObjects.map((object) => object.uuid);
    return JSON.stringify([GameEntityClassRegistry.generation(), identifiers, componentsList]);
  }

  /**
   * Applies one edit to every bound object as one undoable step.
   *
   * @param edit Produces an object's new overrides from its current ones.
   */
  private commit(edit: (components: GameEntityComponents) => GameEntityComponents): void {
    const command = new CommandGameEntityComponentsSet(this.boundObjects, edit);
    if (!command.hasChanges()) {
      this.render();
      return;
    }
    if (this.commandStack) {
      this.commandStack.push(command);
    } else {
      command.execute();
    }
    this.render();
  }

  /**
   * Returns the type paths every object carries, sorted.
   *
   * @param componentsList Overrides of every object.
   * @returns Shared type paths.
   */
  private static typePathsShared(componentsList: readonly GameEntityComponents[]): string[] {
    const [first, ...others] = componentsList;
    if (!first) {
      return [];
    }
    return Object.keys(first)
      .filter((typePath) => others.every((components) => components[typePath] !== undefined))
      .sort();
  }
}
