import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import {
  type GameEntityClass,
  type GameEntityField,
  gameEntityClassShortName,
} from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';
import type { GameEntityComponents } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityComponentsEdit } from '@/game_entity/component/game_entity_components_edit.js';
import { gameEntityFieldEditorCreate } from '@/game_entity/ui/fields/game_entity_field_editor_factory.js';
import { GameEntityUiChrome } from '@/game_entity/ui/game_entity_ui_chrome.js';
import type { PreviewFieldValue } from '@/preview/protocol/preview_protocol_placeable_types.js';
import { panelPropertiesRowFieldStretch } from '@/ui/properties/panel_properties_row.js';

/** Applies one edit to the overrides of every bound object. */
export type GameEntityComponentsCommit = (edit: (components: GameEntityComponents) => GameEntityComponents) => void;

/** How a component block finds its class and what it offers. */
export interface GameEntityComponentBlockOptions {
  /** Class describing the fields; looked up by type path when omitted. */
  gameClass?: GameEntityClass | null;
  /** False hides the remove button. Defaults to true. */
  removable?: boolean;
}

/**
 * Builds the inspector block of one component shared by the selection: its
 * title with a remove button and one row per field. Overridden fields are
 * highlighted and offer a reset to the class default.
 */
export class GameEntityComponentBlock {
  private readonly typePath: string;
  private readonly componentsList: readonly GameEntityComponents[];
  private readonly commit: GameEntityComponentsCommit;
  private readonly gameClass: GameEntityClass | null;
  private readonly removable: boolean;
  private readonly element: HTMLElement;

  /**
   * Builds the block.
   *
   * @param typePath Component type path.
   * @param componentsList Overrides of every bound object.
   * @param commit Applies an edit to every bound object.
   * @param options Class override and offered controls.
   */
  constructor(
    typePath: string,
    componentsList: readonly GameEntityComponents[],
    commit: GameEntityComponentsCommit,
    options: GameEntityComponentBlockOptions = {},
  ) {
    this.typePath = typePath;
    this.componentsList = componentsList;
    this.commit = commit;
    this.gameClass = options.gameClass === undefined ? GameEntityClassRegistry.classFind(typePath) : options.gameClass;
    this.removable = options.removable !== false;
    this.element = document.createElement('div');
    this.element.dataset['gameComponent'] = typePath;
    this.element.appendChild(this.titleCreate());
    this.fieldsAppend(this.element, this.fieldsShown(), 0);
  }

  /**
   * Returns the block element.
   *
   * @returns Block root.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Creates the title row: the class label, a notice for classes the game does
   * not report, and the remove button when removing is offered.
   *
   * @returns Title row.
   */
  private titleCreate(): HTMLElement {
    const label = this.gameClass?.label ?? gameEntityClassShortName(this.typePath);
    const notice = this.gameClass ? '' : ' (not in game)';
    const trailing = this.removable ? this.removeButtonCreate(label) : document.createElement('span');
    return GameEntityUiChrome.titleRowCreate(`${label}${notice}`, this.typePath, trailing);
  }

  /**
   * Creates the button that removes the component from every bound object.
   *
   * @param label Component label used in the tooltip.
   * @returns Remove button.
   */
  private removeButtonCreate(label: string): HTMLElement {
    return GameEntityUiChrome.iconButtonCreate('×', `Remove ${label}`, () =>
      this.commit((components) => GameEntityComponentsEdit.componentRemove(components, this.typePath)),
    );
  }

  /**
   * Returns the fields to show: the class fields, or one read-only field per
   * stored override when the class is unknown.
   *
   * @returns Fields in display order.
   */
  private fieldsShown(): GameEntityField[] {
    if (this.gameClass) {
      return this.gameClass.fields;
    }
    const paths = new Set(this.componentsList.flatMap((components) => Object.keys(components[this.typePath] ?? {})));
    return [...paths].map((path) => ({ path, label: path, kind: 'unsupported', default: null }));
  }

  /**
   * Appends the rows of fields, descending into groups.
   *
   * @param parent Element receiving the rows.
   * @param fields Fields to show.
   * @param depth Group nesting depth, used for indentation.
   */
  private fieldsAppend(parent: HTMLElement, fields: readonly GameEntityField[], depth: number): void {
    for (const field of fields.filter((candidate) => candidate.hidden !== true)) {
      if (field.kind === 'group') {
        parent.appendChild(GameEntityUiChrome.groupCaptionCreate(field.label, depth));
        this.fieldsAppend(parent, field.children ?? [], depth + 1);
      } else {
        parent.appendChild(this.fieldRowCreate(field, depth));
      }
    }
  }

  /**
   * Creates the row of one value field.
   *
   * @param field Field description.
   * @param depth Group nesting depth.
   * @returns Row element.
   */
  private fieldRowCreate(field: GameEntityField, depth: number): HTMLElement {
    const editor = gameEntityFieldEditorCreate(field, this.gameClass !== null);
    editor.valuesShow(this.componentsList.map((components) => this.valueOf(components, field)));
    editor.bindCommit((edit) =>
      this.commit((components) =>
        GameEntityComponentsEdit.fieldSet(components, this.typePath, field, edit(this.valueOf(components, field))),
      ),
    );
    const overridden = this.componentsList.some((components) =>
      GameEntityComponentResolver.isOverridden(components, this.typePath, field.path),
    );
    const reset = overridden && this.gameClass ? this.resetButtonCreate(field) : null;
    return GameEntityUiChrome.fieldRowCreate(
      field,
      depth,
      overridden,
      panelPropertiesRowFieldStretch(editor.getElement()),
      reset,
    );
  }

  /**
   * Creates the button that resets a field to the class default.
   *
   * @param field Field description.
   * @returns Reset button.
   */
  private resetButtonCreate(field: GameEntityField): HTMLElement {
    return GameEntityUiChrome.iconButtonCreate('↺', `Reset ${field.label} to the game default`, () =>
      this.commit((components) => GameEntityComponentsEdit.fieldReset(components, this.typePath, field.path)),
    );
  }

  /**
   * Returns a field's value on one object.
   *
   * @param components Overrides of the object.
   * @param field Field description.
   * @returns Effective value.
   */
  private valueOf(components: GameEntityComponents, field: GameEntityField): PreviewFieldValue {
    return GameEntityComponentResolver.valueEffective(components, this.typePath, field);
  }
}
