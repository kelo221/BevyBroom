import { InputCheckbox } from '@/ui/input/input_checkbox.js';
import { InputNumeric } from '@/ui/input/input_numeric.js';
import { InputNumberSpinner } from '@/ui/input/input_number_spinner.js';
import { buttonCompactCreate } from '@/ui/button/button_compact.js';
import { faceEditSheetCheckboxLabelCreate } from '@/texture/ui/face_edit_sheet/widgets/face_edit_sheet_widget_checkbox_label.js';
import {
  getStateDisplacementSculpt,
  type DisplacementSculptSettings,
} from '@/displacement/state/state_displacement_sculpt.js';
import {
  DISPLACEMENT_COLLISION_FLAG_KEYS,
  DISPLACEMENT_POWERS,
  type DisplacementCollisionFlags,
  type DisplacementPower,
} from '@/displacement/model/displacement_types.js';
import type { ControllerDisplacementActions } from '@/displacement/controller/controller_displacement_actions.js';
import type {
  DisplacementAttributeChanges,
  DisplacementAttributesShared,
} from '@/displacement/controller/displacement_attributes.js';
import {
  PANEL_DISPLACEMENT_BUTTON_HEIGHT_PX,
  PanelDisplacementSection,
  type PanelDisplacementActionRun,
} from './panel_displacement_section.js';
import { formLayoutFieldLabelCreate, formLayoutRowCreate } from '@/ui/form/form_layout.js';

/** Visible names of the collision flags. */
const PANEL_DISPLACEMENT_FLAG_LABELS: Readonly<Record<keyof DisplacementCollisionFlags, string>> = {
  noPhysicsCollision: 'No Physics Collision',
  noHullCollision: 'No Hull Collision',
  noRayCollision: 'No Ray Collision',
  seals: 'Seals',
};

/**
 * Hammer++ style Attributes group of the Displacement tab: Power, Elevation,
 * Scale and the collision flags of the selected displaced faces, written by
 * Apply as one undo step. Fields show the values the displaced faces share,
 * blank while nothing is displaced and a dash or an indeterminate box where
 * they differ. With nothing displaced Power shows the power Create uses.
 */
export class PanelDisplacementAttributesSection extends PanelDisplacementSection {
  private readonly powerInput = new InputNumberSpinner({ ariaLabel: 'Power', step: 1, decimals: 0, width: '64px' });
  private readonly elevationInput = new InputNumeric({ ariaLabel: 'Elevation', width: '64px' });
  private readonly scaleInput = new InputNumeric({ ariaLabel: 'Scale', width: '64px' });
  private readonly flagCheckboxes = new Map<keyof DisplacementCollisionFlags, InputCheckbox>(
    DISPLACEMENT_COLLISION_FLAG_KEYS.map((key) => [key, new InputCheckbox(PANEL_DISPLACEMENT_FLAG_LABELS[key])]),
  );
  private displacedCount = 0;

  /**
   * Builds the attribute fields.
   *
   * @param actionRun Runs an action on the selected faces.
   */
  constructor(private readonly actionRun: PanelDisplacementActionRun) {
    super('Attributes', 'panel-displacement-attributes');
    this.element.append(this.fieldsRowBuild(), this.flagsBuild(), this.applyRowBuild());
    this.powerInput.bindCommit(() => this.powerCommit());
    this.disposerAdd(() => this.powerInput.dispose());
    this.disposerAdd(() => this.elevationInput.dispose());
    this.disposerAdd(() => this.scaleInput.dispose());
  }

  /**
   * Shows the Create power while no selected face is displaced.
   *
   * @param settings Current displacement sculpt settings.
   */
  override settingsShow(settings: Readonly<DisplacementSculptSettings>): void {
    if (this.displacedCount === 0) {
      this.powerInput.setNumber(settings.power, 0);
    }
  }

  /**
   * Shows the attribute values the selected displaced faces share.
   *
   * @param actions Installed actions over the selected faces, or null.
   */
  override selectionShow(actions: ControllerDisplacementActions | null): void {
    const shared = actions?.attributesSharedRead() ?? null;
    this.displacedCount = shared?.displacedCount ?? 0;
    if (!shared || shared.displacedCount === 0) {
      this.fieldsBlankShow();
      return;
    }
    this.powerInput.setNumber(shared.power, 0);
    this.elevationInput.setNumber(shared.elevation, 2);
    this.scaleInput.setNumber(shared.scale, 2);
    this.flagsSharedShow(shared);
  }

  /** Clears every field and shows the Create power. */
  private fieldsBlankShow(): void {
    this.powerInput.setNumber(getStateDisplacementSculpt().settingsRead().power, 0);
    this.elevationInput.setText('');
    this.scaleInput.setText('');
    this.flagCheckboxes.forEach((checkbox) => checkbox.setSharedValues([false]));
  }

  /**
   * Shows the shared collision flags, indeterminate where the faces differ.
   *
   * @param shared Shared attribute values.
   */
  private flagsSharedShow(shared: DisplacementAttributesShared): void {
    this.flagCheckboxes.forEach((checkbox, key) => {
      const value = shared.flags[key];
      checkbox.setSharedValues(value === null ? [true, false] : [value]);
    });
  }

  /**
   * Builds the Power, Elevation and Scale row.
   *
   * @returns Row element.
   */
  private fieldsRowBuild(): HTMLElement {
    return formLayoutRowCreate([
      formLayoutFieldLabelCreate('Power'),
      this.powerInput.spinnerElementRead(),
      formLayoutFieldLabelCreate('Elev'),
      this.elevationInput.getElement(),
      formLayoutFieldLabelCreate('Scale'),
      this.scaleInput.getElement(),
    ]);
  }

  /**
   * Builds the column of collision flag checkboxes.
   *
   * @returns Column element.
   */
  private flagsBuild(): HTMLElement {
    const column = document.createElement('div');
    column.style.display = 'flex';
    column.style.flexDirection = 'column';
    column.style.gap = '2px';
    this.flagCheckboxes.forEach((checkbox, key) => {
      column.append(faceEditSheetCheckboxLabelCreate(checkbox, PANEL_DISPLACEMENT_FLAG_LABELS[key]));
    });
    return column;
  }

  /**
   * Builds the row holding the Apply button.
   *
   * @returns Row element.
   */
  private applyRowBuild(): HTMLElement {
    const applyButton = buttonCompactCreate({
      title: 'Apply',
      text: 'Apply',
      widthPx: null,
      heightPx: PANEL_DISPLACEMENT_BUTTON_HEIGHT_PX,
      onClick: () => this.attributesApply(),
    });
    return formLayoutRowCreate([applyButton]);
  }

  /** Stores a typed valid power as the Create power, or shows the stored one. */
  private powerCommit(): void {
    const power = this.powerRead();
    if (power === null) {
      this.powerInput.setNumber(getStateDisplacementSculpt().settingsRead().power, 0);
      return;
    }
    getStateDisplacementSculpt().settingsWrite({ power });
  }

  /**
   * Reads the Power field as a valid power.
   *
   * @returns Power, or null when the field holds no valid power.
   */
  private powerRead(): DisplacementPower | null {
    const value = this.powerInput.parseNumberOrNull();
    return DISPLACEMENT_POWERS.find((power) => power === value) ?? null;
  }

  /** Writes every field holding a value to the selected displaced faces. */
  private attributesApply(): void {
    const changes = this.attributeChangesRead();
    this.actionRun((actions) => actions.attributesApply(changes));
  }

  /**
   * Collects the fields that hold a value; blank, mixed and indeterminate
   * fields are left out.
   *
   * @returns Attribute changes.
   */
  private attributeChangesRead(): DisplacementAttributeChanges {
    const changes: DisplacementAttributeChanges = { flags: this.flagChangesRead() };
    const power = this.powerRead();
    const elevation = this.elevationInput.parseNumberOrNull();
    const scale = this.scaleInput.parseNumberOrNull();
    if (power !== null) changes.power = power;
    if (elevation !== null) changes.elevation = elevation;
    if (scale !== null) changes.scale = scale;
    return changes;
  }

  /**
   * Collects the collision flags whose checkbox is not indeterminate.
   *
   * @returns Flags to write.
   */
  private flagChangesRead(): Partial<DisplacementCollisionFlags> {
    const flags: Partial<DisplacementCollisionFlags> = {};
    this.flagCheckboxes.forEach((checkbox, key) => {
      if (!checkbox.getElement().indeterminate) {
        flags[key] = checkbox.getValue();
      }
    });
    return flags;
  }
}
