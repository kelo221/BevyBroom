import type * as THREE from 'three';
import type { GameEntityIoPin } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityLogicMatcher } from '@/game_entity/logic/game_entity_logic_matcher.js';
import { GameEntityLogicPins } from '@/game_entity/logic/game_entity_logic_pins.js';
import type { AuthoredLogicOutput } from '@/game_entity/logic/game_entity_logic_types.js';
import { buttonCompactCreate, buttonCompactEnabledWrite } from '@/ui/button/button_compact.js';
import { InputCheckbox } from '@/ui/input/input_checkbox.js';
import { InputNumeric } from '@/ui/input/input_numeric.js';
import type { InputSelectChoice } from '@/ui/input/input_select.js';
import { InputText } from '@/ui/input/input_text.js';
import { InputTextSuggest } from '@/ui/input/input_text_suggest.js';
import { panelPropertiesRowCreate } from '@/ui/properties/panel_properties_row.js';
import { ToolbarIconsHammer } from '@/ui/toolbar/toolbar_icons_hammer.js';
import type { ObjectPropertiesTabContext } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { ObjectPropertiesTabSection } from '@/ui/object_properties/tabs/object_properties_tab_section.js';
import { objectPropertiesLogicButtonCreate } from '../table/object_properties_logic_button_bar.js';
import type { ObjectPropertiesLogicOutputsModel } from './object_properties_logic_outputs_model.js';

/**
 * Row editor of the Outputs tab: edits the selected connection's output, target
 * (typed, picked with the eyedropper or marked in the scene), input, parameter,
 * delay and fire once flag.
 */
export class ObjectPropertiesLogicOutputsSectionEditor extends ObjectPropertiesTabSection {
  private readonly model: ObjectPropertiesLogicOutputsModel;
  private readonly outputInput = new InputTextSuggest('My output named');
  private readonly targetInput = new InputTextSuggest('Targets entities named');
  private readonly inputInput = new InputTextSuggest('Via this input');
  private readonly parameterInput = new InputText('With a parameter override of');
  private readonly delayInput = new InputNumeric({ ariaLabel: 'After a delay in seconds of', width: '100%' });
  private readonly fireOnceCheckbox = new InputCheckbox('Fire once only');
  private readonly pickButton: HTMLButtonElement;
  private readonly markButton: HTMLButtonElement;

  /**
   * Creates the row editor.
   *
   * @param context Tab context used for picking and marking targets.
   * @param model Outputs state shared with the table.
   */
  constructor(context: ObjectPropertiesTabContext, model: ObjectPropertiesLogicOutputsModel) {
    super(context, 'Edit Output');
    this.model = model;
    this.pickButton = this.pickButtonCreate();
    this.markButton = objectPropertiesLogicButtonCreate({
      text: 'Mark',
      title: 'Select every object this target matches',
      action: 'mark-targets',
      onClick: () => this.targetsMark(),
    });
    this.fieldsCommitBind();
    this.element.append(...this.rowsCreate());
  }

  /**
   * Shows the selected row, or empty disabled fields without one.
   *
   * @param _objects Edited objects; the model already holds the source.
   */
  refresh(_objects: readonly THREE.Object3D[]): void {
    const row = this.model.selectedRowRead();
    this.fieldsEnabledWrite(row !== null);
    this.suggestionsRefresh(row);
    this.fieldsValuesWrite(row);
  }

  /** Releases the delay field listeners. */
  override dispose(): void {
    this.delayInput.dispose();
  }

  /**
   * Builds the labeled rows of the editor.
   *
   * @returns Row elements.
   */
  private rowsCreate(): HTMLElement[] {
    const targetField = this.fieldGroupCreate([this.targetInput.getElement(), this.pickButton, this.markButton]);
    this.targetInput.getElement().style.flex = '1';
    return [
      panelPropertiesRowCreate('Output', this.outputInput),
      panelPropertiesRowCreate('Target', { getElement: () => targetField }),
      panelPropertiesRowCreate('Input', this.inputInput),
      panelPropertiesRowCreate('Parameter', this.parameterInput),
      panelPropertiesRowCreate('Delay', this.delayInput),
      panelPropertiesRowCreate('Once', {
        getElement: () => this.fieldGroupCreate([this.fireOnceCheckbox.getElement()]),
      }),
    ];
  }

  /**
   * Lays out controls side by side so they share one row's field slot.
   *
   * @param controls Controls from left to right.
   * @returns Group element.
   */
  private fieldGroupCreate(controls: readonly HTMLElement[]): HTMLElement {
    const group = document.createElement('div');
    group.style.display = 'flex';
    group.style.alignItems = 'center';
    group.style.gap = '4px';
    group.style.minWidth = '0';
    group.append(...controls);
    return group;
  }

  /**
   * Creates the eyedropper button that picks the target in the viewport.
   *
   * @returns Button element.
   */
  private pickButtonCreate(): HTMLButtonElement {
    const button = buttonCompactCreate({
      title: 'Pick the target entity in the viewport',
      svgIcon: ToolbarIconsHammer.eyedropper(),
      widthPx: 24,
      heightPx: 24,
      onClick: () => this.targetPickBegin(),
    });
    button.dataset['logicAction'] = 'pick-target';
    return button;
  }

  /** Writes every field's committed value into the selected row. */
  private fieldsCommitBind(): void {
    const model = this.model;
    this.outputInput.bindCommit(() => model.selectedRowPatch({ output: this.outputInput.getValue() }));
    this.targetInput.bindCommit(() => model.selectedRowPatch({ target: this.targetInput.getValue() }));
    this.inputInput.bindCommit(() => model.selectedRowPatch({ input: this.inputInput.getValue() }));
    this.parameterInput.bindCommit(() => model.selectedRowPatch({ parameter: this.parameterInput.getValue() }));
    this.delayInput.bindCommit(() => this.delayCommit());
    this.fireOnceCheckbox.bindCommit(() =>
      model.selectedRowPatch({ times_to_fire: this.fireOnceCheckbox.getValue() ? 1 : -1 }),
    );
  }

  /**
   * Writes a valid typed delay into the selected row, restoring the field
   * otherwise.
   */
  private delayCommit(): void {
    const delay = this.delayInput.parseNumberOrNull();
    if (delay === null) {
      this.refresh([]);
      return;
    }
    this.model.selectedRowPatch({ delay });
  }

  /** Waits for an object pick and targets the picked object by its name. */
  private targetPickBegin(): void {
    this.context.objectPickBegin((picked) => {
      if (picked.name.trim() !== '') {
        this.model.selectedRowPatch({ target: picked.name });
      }
    });
  }

  /** Selects every object the selected row's target matches. */
  private targetsMark(): void {
    const row = this.model.selectedRowRead();
    if (row) {
      this.context.objectsMark(this.model.targetsResolve(row), false);
    }
  }

  /**
   * Enables or disables every field and button.
   *
   * @param isEnabled True while a row is selected.
   */
  private fieldsEnabledWrite(isEnabled: boolean): void {
    [
      this.outputInput.inputElementRead(),
      this.targetInput.inputElementRead(),
      this.inputInput.inputElementRead(),
      this.parameterInput.getElement(),
      this.delayInput.getElement(),
      this.fireOnceCheckbox.getElement(),
    ].forEach((field) => {
      field.disabled = !isEnabled;
    });
    buttonCompactEnabledWrite(this.pickButton, isEnabled);
    buttonCompactEnabledWrite(this.markButton, isEnabled);
  }

  /**
   * Offers the source's outputs, the scene's names and the targets' inputs.
   *
   * @param row Selected row, or null.
   */
  private suggestionsRefresh(row: AuthoredLogicOutput | null): void {
    const source = this.model.sourceRead();
    const outputs = source ? GameEntityLogicPins.outputsOfObject(source) : [];
    const inputs = row ? GameEntityLogicPins.inputsOfObjects(this.model.targetsResolve(row)) : [];
    this.outputInput.suggestionsWrite(ObjectPropertiesLogicOutputsSectionEditor.pinChoicesCreate(outputs));
    this.inputInput.suggestionsWrite(ObjectPropertiesLogicOutputsSectionEditor.pinChoicesCreate(inputs));
    this.targetInput.suggestionsWrite(
      GameEntityLogicMatcher.targetNamesList(this.context.worldObjectRead()).map((name) => ({
        value: name,
        label: name,
      })),
    );
  }

  /**
   * Shows the fields of a row, or empty fields.
   *
   * @param row Selected row, or null.
   */
  private fieldsValuesWrite(row: AuthoredLogicOutput | null): void {
    this.outputInput.setSharedValues([row?.output ?? '']);
    this.targetInput.setSharedValues([row?.target ?? '']);
    this.inputInput.setSharedValues([row?.input ?? '']);
    this.parameterInput.setSharedValues([row?.parameter ?? '']);
    this.delayInput.setNumber(row?.delay ?? 0, 2);
    this.fireOnceCheckbox.setSharedValues([row?.times_to_fire === 1]);
  }

  /**
   * Turns pins into suggestions labeled with their descriptions.
   *
   * @param pins Entity I/O pins.
   * @returns Suggestions.
   */
  private static pinChoicesCreate(pins: readonly GameEntityIoPin[]): InputSelectChoice[] {
    return pins.map((pin) => ({ value: pin.name, label: pin.description || pin.name, title: pin.description }));
  }
}
