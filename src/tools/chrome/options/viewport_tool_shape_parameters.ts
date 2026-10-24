import { Theme } from '@/theme.js';
import { InputNumeric } from '@/ui/input/input_numeric.js';
import { InputSelect, type InputSelectChoice } from '@/ui/input/input_select.js';
import type { ShapeDrawSettings } from '@/tools/shape_draw/shapes/shape_draw_settings.js';
import type { ShapeDrawParameterState } from '@/tools/shape_draw/shapes/shape_draw_settings.js';
import type {
  ShapeDrawChoiceParameter,
  ShapeDrawNumberParameter,
} from '@/tools/shape_draw/shapes/shape_draw_shape_parameter.js';
import { shapeDrawShapeFind } from '@/tools/shape_draw/shapes/shape_draw_shape_registry.js';

/** Options bar parameter fields of the selected draw shape. */
export class ViewportToolShapeParameters {
  private readonly settings: ShapeDrawSettings;
  private readonly onParameterCommit: () => void;
  private readonly root: HTMLElement;

  /**
   * Creates the parameter field row.
   *
   * @param parentElement Host used to resolve the owner document.
   * @param settings Shape selection the fields read and write.
   * @param onParameterCommit Invoked after a parameter value changed.
   */
  constructor(parentElement: HTMLElement, settings: ShapeDrawSettings, onParameterCommit: () => void) {
    this.settings = settings;
    this.onParameterCommit = onParameterCommit;
    this.root = parentElement.ownerDocument.createElement('div');
    this.styleRoot();
    this.rebuild();
  }

  /**
   * Returns the row element.
   *
   * @returns Root element.
   */
  getElement(): HTMLElement {
    return this.root;
  }

  /** Rebuilds every field for the currently selected shape. */
  rebuild(): void {
    this.root.replaceChildren();
    const shape = shapeDrawShapeFind(this.settings.getSelectedShapeId());
    for (const state of this.settings.parameterStatesList(shape.id)) {
      this.root.appendChild(this.fieldCreate(state));
    }
  }

  /** Styles the row as an inline strip of labeled fields. */
  private styleRoot(): void {
    this.root.style.display = 'flex';
    this.root.style.alignItems = 'center';
    this.root.style.gap = '4px';
    this.root.style.flex = '0 0 auto';
  }

  /**
   * Builds one labeled field for a parameter state.
   *
   * @param state Parameter and its current value.
   * @returns Field wrapper element.
   */
  private fieldCreate(state: ShapeDrawParameterState): HTMLElement {
    const wrapper = this.root.ownerDocument.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '3px';
    wrapper.appendChild(this.labelCreate(state.parameter.label));
    wrapper.appendChild(this.controlCreate(state));
    return wrapper;
  }

  /**
   * Builds one field label.
   *
   * @param text Label text.
   * @returns Label element.
   */
  private labelCreate(text: string): HTMLElement {
    const label = this.root.ownerDocument.createElement('span');
    label.textContent = text;
    label.style.fontFamily = Theme.uiFontFamily;
    label.style.fontSize = '11px';
    label.style.whiteSpace = 'nowrap';
    return label;
  }

  /**
   * Builds the input control for a parameter state.
   *
   * @param state Parameter and its current value.
   * @returns Input element.
   */
  private controlCreate(state: ShapeDrawParameterState): HTMLElement {
    return state.parameter.kind === 'number'
      ? this.numericCreate(state.parameter, state.value)
      : this.selectCreate(state.parameter, state.value);
  }

  /**
   * Builds the numeric field of a numeric parameter.
   *
   * @param parameter Numeric parameter description.
   * @param value Current value.
   * @returns Numeric input element.
   */
  private numericCreate(parameter: ShapeDrawNumberParameter, value: number | string): HTMLElement {
    const shapeId = shapeDrawShapeFind(this.settings.getSelectedShapeId()).id;
    const input = new InputNumeric({ step: parameter.step, width: '56px', ariaLabel: parameter.label });
    input.setNumber(value as number, 2);
    input.bindCommit(() => this.numericCommit(input, parameter, shapeId));
    return input.getElement();
  }

  /**
   * Stores a committed numeric value.
   *
   * @param input Field the user committed.
   * @param parameter Numeric parameter description.
   * @param shapeId Shape the parameter belongs to.
   */
  private numericCommit(input: InputNumeric, parameter: ShapeDrawNumberParameter, shapeId: string): void {
    const parsed = input.parse();
    if (parsed.kind !== 'value') {
      return;
    }
    this.parameterCommit(shapeId, parameter.id, parsed.value);
  }

  /**
   * Builds the select field of a choice parameter.
   *
   * @param parameter Choice parameter description.
   * @param value Current value.
   * @returns Select element.
   */
  private selectCreate(parameter: ShapeDrawChoiceParameter, value: number | string): HTMLElement {
    const shapeId = shapeDrawShapeFind(this.settings.getSelectedShapeId()).id;
    const choices: InputSelectChoice[] = parameter.choices.map((choice) => ({
      value: choice.value,
      label: choice.label,
    }));
    const select = new InputSelect(choices, parameter.label);
    select.setSharedValues([String(value)]);
    select.bindCommit(() => this.parameterCommit(shapeId, parameter.id, select.getValue()));
    return select.getElement();
  }

  /**
   * Stores one parameter value and notifies the host.
   *
   * @param shapeId Shape the parameter belongs to.
   * @param parameterId Parameter identifier.
   * @param value Value to store.
   */
  private parameterCommit(shapeId: string, parameterId: string, value: number | string): void {
    this.settings.parameterSet(shapeId, parameterId, value);
    this.onParameterCommit();
  }
}
