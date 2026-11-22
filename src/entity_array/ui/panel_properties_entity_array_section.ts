import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { UndoCommand } from '@/commands/command_undo.js';
import { entityBoundsOwnerOf } from '@/entity/bounds/entity_bounds.js';
import { CommandEntityArrayBake } from '@/entity_array/commands/command_entity_array_bake.js';
import { CommandEntityArraySet } from '@/entity_array/commands/command_entity_array_set.js';
import { EntityArrayCopyMark } from '@/entity_array/model/entity_array_copy_mark.js';
import {
  ENTITY_ARRAY_FIELDS,
  type EntityArraySettings,
  EntityArraySettingsRules,
} from '@/entity_array/model/entity_array_settings.js';
import { EntityArrayStore } from '@/entity_array/model/entity_array_store.js';
import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import type { GameEntityFieldEdit } from '@/game_entity/ui/fields/game_entity_field_editor.js';
import { gameEntityFieldEditorCreate } from '@/game_entity/ui/fields/game_entity_field_editor_factory.js';
import { GameEntityUiChrome } from '@/game_entity/ui/game_entity_ui_chrome.js';
import { buttonCompactCreate } from '@/ui/button/button_compact.js';
import {
  panelPropertiesEntitySwitchCreate,
  panelPropertiesEntitySwitchValue,
} from '@/ui/properties/panel_properties_entity_section.js';
import type { PanelPropertiesSection, PanelPropertiesSectionChrome } from '@/ui/properties/panel_properties_section.js';
import { panelPropertiesRowCreate, panelPropertiesRowFieldStretch } from '@/ui/properties/panel_properties_row.js';

/** Height of the bake button in pixels. */
const PANEL_PROPERTIES_ENTITY_ARRAY_BUTTON_HEIGHT = 18;

/** Switch value that means the entity repeats. */
const PANEL_PROPERTIES_ENTITY_ARRAY_ON = panelPropertiesEntitySwitchValue(true);

/**
 * Inspector section that makes the selected entities repeat along their own
 * axes, edits the counts and gaps, and bakes the copies into ordinary entities.
 */
export class PanelPropertiesEntityArraySection implements PanelPropertiesSection {
  private readonly section: HTMLElement;
  private readonly body: HTMLElement;
  private boundOwners: THREE.Object3D[] = [];
  private commandStack: CommandStack | null = null;
  private sceneChanged: (() => void) | null = null;

  /**
   * Creates the section.
   *
   * @param chrome Element factories of the hosting panel.
   */
  constructor(chrome: PanelPropertiesSectionChrome) {
    this.section = chrome.createSectionContainer();
    this.section.style.display = 'none';
    this.section.appendChild(chrome.createSectionHeader('Array'));
    this.body = document.createElement('div');
    this.section.appendChild(this.body);
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
   * Sets what runs after a bake moved copies out of their source.
   *
   * @param callback Structure change callback, or null.
   */
  setSceneChanged(callback: (() => void) | null): void {
    this.sceneChanged = callback;
  }

  /**
   * Shows the section when every selected object is an entity that is not an
   * array copy, and fills it from those entities.
   *
   * @param objects Current inspector selection.
   */
  updateFromObjects(objects: readonly THREE.Object3D[]): void {
    const owners = objects.map((object) => entityBoundsOwnerOf(object));
    const isShown =
      owners.length > 0 && owners.every((owner) => owner !== null && !EntityArrayCopyMark.is(owner));
    this.boundOwners = isShown ? [...new Set(owners.filter((owner): owner is THREE.Object3D => owner !== null))] : [];
    this.section.style.display = isShown ? 'block' : 'none';
    if (isShown) {
      this.rowsWrite();
    }
  }

  /** Rebuilds the rows for the bound entities. */
  private rowsWrite(): void {
    const settingsList = this.boundOwners.map((owner) => EntityArrayStore.read(owner));
    const repeating = settingsList.filter((settings): settings is EntityArraySettings => settings !== null);
    this.body.replaceChildren(this.switchRowCreate(repeating.length > 0));
    if (repeating.length === 0) {
      return;
    }
    ENTITY_ARRAY_FIELDS.forEach((field) => this.body.appendChild(this.fieldRowCreate(field, repeating)));
    this.body.appendChild(this.bakeRowCreate());
  }

  /**
   * Creates the row that turns repeating on and off.
   *
   * @param isRepeating Whether any bound entity repeats.
   * @returns Row element.
   */
  private switchRowCreate(isRepeating: boolean): HTMLElement {
    const select = panelPropertiesEntitySwitchCreate('Repeat the entity along its own axes');
    select.setSharedValues([panelPropertiesEntitySwitchValue(isRepeating)]);
    select.bindCommit(() => this.switchCommit(select.getValue() === PANEL_PROPERTIES_ENTITY_ARRAY_ON));
    return panelPropertiesRowCreate('Repeat', select);
  }

  /**
   * Creates the row editing one array field.
   *
   * @param field Field description.
   * @param settingsList Settings of the bound entities that repeat.
   * @returns Row element.
   */
  private fieldRowCreate(field: GameEntityField, settingsList: readonly EntityArraySettings[]): HTMLElement {
    const editor = gameEntityFieldEditorCreate(field, true);
    editor.valuesShow(
      settingsList.map((settings) => EntityArraySettingsRules.toFieldValues(settings)[field.path] ?? field.default),
    );
    editor.bindCommit((edit) => this.fieldCommit(field, edit));
    const editorElement = panelPropertiesRowFieldStretch(editor.getElement());
    return GameEntityUiChrome.fieldRowCreate(field, 0, false, editorElement, null);
  }

  /**
   * Creates the row with the button that bakes the copies.
   *
   * @returns Row element.
   */
  private bakeRowCreate(): HTMLElement {
    const button = buttonCompactCreate({
      title: 'Turn the copies into ordinary entities that are edited one by one',
      text: 'Bake Copies',
      widthPx: null,
      heightPx: PANEL_PROPERTIES_ENTITY_ARRAY_BUTTON_HEIGHT,
      onClick: () => this.bakeCommit(),
    });
    return panelPropertiesRowCreate('', { getElement: () => button });
  }

  /**
   * Makes every bound entity repeat with its settings or default ones, or
   * stops them repeating, as one undo step.
   *
   * @param isRepeating True to repeat, false to stop.
   */
  private switchCommit(isRepeating: boolean): void {
    const settingsOf = (current: EntityArraySettings | null): EntityArraySettings | null =>
      isRepeating ? (current ?? EntityArraySettingsRules.createDefault()) : null;
    this.commandRun(new CommandEntityArraySet(this.boundOwners, settingsOf));
  }

  /**
   * Applies an edit of one field to every bound entity that repeats, as one
   * undo step.
   *
   * @param field Edited field.
   * @param edit Turns an entity's current value into its new value.
   */
  private fieldCommit(field: GameEntityField, edit: GameEntityFieldEdit): void {
    const settingsOf = (current: EntityArraySettings | null): EntityArraySettings | null => {
      if (current === null) {
        return null;
      }
      const values = EntityArraySettingsRules.toFieldValues(current);
      return EntityArraySettingsRules.fromUnknown({ ...values, [field.path]: edit(values[field.path] ?? null) });
    };
    this.commandRun(new CommandEntityArraySet(this.boundOwners, settingsOf));
  }

  /** Bakes the copies of every bound entity as one undo step. */
  private bakeCommit(): void {
    this.commandRun(new CommandEntityArrayBake(this.boundOwners));
    this.sceneChanged?.();
  }

  /**
   * Records a command that changes something and refreshes the rows.
   *
   * @param command Set or bake command.
   */
  private commandRun(command: UndoCommand & { hasChanges(): boolean }): void {
    if (!command.hasChanges()) {
      return;
    }
    if (this.commandStack) {
      this.commandStack.push(command);
    } else {
      command.execute();
    }
    this.rowsWrite();
  }
}
