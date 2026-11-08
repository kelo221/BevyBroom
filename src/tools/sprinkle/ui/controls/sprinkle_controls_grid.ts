import { InputNumeric } from '@/ui/input/input_numeric.js';
import { InputCheckbox } from '@/ui/input/input_checkbox.js';
import { formLayoutRowCreate } from '@/ui/form/form_layout.js';
import { faceEditSheetCheckboxLabelCreate } from '@/texture/ui/face_edit_sheet/widgets/face_edit_sheet_widget_checkbox_label.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { SPRINKLE_GRID_SIZE_MIN, type SprinkleConfig } from '@/tools/sprinkle/sprinkle_types.js';
import type { SprinkleDefinition } from '@/tools/sprinkle/definition/sprinkle_definition.js';
import {
  SPRINKLE_CONTROLS_METER_DECIMALS,
  SprinkleControls,
  type SprinkleControlsServices,
} from './sprinkle_controls.js';

/** Width of one grid field. */
const SPRINKLE_CONTROLS_GRID_FIELD_WIDTH = '76px';

/**
 * Grid controls of the Entity Sprinkle window: Grid Offset, Grid Size, Use Grid
 * and Use Grid Size from Definition. The size fields show the definition's grid
 * and are disabled while the definition grid is used.
 */
export class SprinkleControlsGrid extends SprinkleControls {
  /** Grid offset along the first in-plane axis. */
  readonly offsetUInput = SprinkleControlsGrid.fieldCreate('Sprinkle grid offset U');
  /** Grid offset along the second in-plane axis. */
  readonly offsetVInput = SprinkleControlsGrid.fieldCreate('Sprinkle grid offset V');
  /** Grid cell size along the first in-plane axis. */
  readonly sizeUInput = SprinkleControlsGrid.fieldCreate('Sprinkle grid size U');
  /** Grid cell size along the second in-plane axis. */
  readonly sizeVInput = SprinkleControlsGrid.fieldCreate('Sprinkle grid size V');
  /** Uses-definition-grid toggle. */
  readonly fromDefinitionCheckbox = new InputCheckbox('Use Grid Size from Definition');
  /** Uses-definition-grid toggle with its caption. */
  readonly fromDefinitionLabel = faceEditSheetCheckboxLabelCreate(
    this.fromDefinitionCheckbox,
    'Use Grid Size from Definition',
  );
  /** Row holding both offset fields. */
  readonly offsetRow = formLayoutRowCreate([this.offsetUInput.getElement(), this.offsetVInput.getElement()]);
  /** Row holding both size fields. */
  readonly sizeRow = formLayoutRowCreate([this.sizeUInput.getElement(), this.sizeVInput.getElement()]);
  /** Copies the editor grid into the size fields. */
  readonly useGridButton: HTMLButtonElement;

  /**
   * Creates the grid controls and binds their commits.
   *
   * @param services Grid interval source and status reporting.
   */
  constructor(private readonly services: SprinkleControlsServices) {
    super();
    this.useGridButton = this.buttonCreate('Use Grid', 'Use the editor grid size', () => this.editorGridApply());
    this.offsetUInput.bindCommit(() => this.offsetCommit());
    this.offsetVInput.bindCommit(() => this.offsetCommit());
    this.sizeUInput.bindCommit(() => this.sizeCommit());
    this.sizeVInput.bindCommit(() => this.sizeCommit());
    this.fromDefinitionCheckbox.bindCommit(() =>
      getStateSprinkleTool().configPatch({ gridSizeFromDefinition: this.fromDefinitionCheckbox.getValue() }),
    );
    this.disposerAdd(() => this.fieldsRead().forEach((field) => field.dispose()));
  }

  /**
   * Creates one meter field.
   *
   * @param ariaLabel Accessible name.
   * @returns Numeric field.
   */
  private static fieldCreate(ariaLabel: string): InputNumeric {
    return new InputNumeric({ ariaLabel, width: SPRINKLE_CONTROLS_GRID_FIELD_WIDTH });
  }

  /**
   * Shows the offset, the effective grid size and the definition toggle.
   *
   * @param config Current Sprinkle tool configuration.
   * @param activeDefinition Definition the configuration names, or null.
   */
  configShow(config: Readonly<SprinkleConfig>, activeDefinition: SprinkleDefinition | null): void {
    const definitionGrid = config.gridSizeFromDefinition ? (activeDefinition?.grid ?? null) : null;
    this.offsetUInput.setNumber(config.gridOffsetU, SPRINKLE_CONTROLS_METER_DECIMALS);
    this.offsetVInput.setNumber(config.gridOffsetV, SPRINKLE_CONTROLS_METER_DECIMALS);
    this.sizeUInput.setNumber(definitionGrid?.sizeU ?? config.gridSizeU, SPRINKLE_CONTROLS_METER_DECIMALS);
    this.sizeVInput.setNumber(definitionGrid?.sizeV ?? config.gridSizeV, SPRINKLE_CONTROLS_METER_DECIMALS);
    this.sizeUInput.getElement().disabled = config.gridSizeFromDefinition;
    this.sizeVInput.getElement().disabled = config.gridSizeFromDefinition;
    this.fromDefinitionCheckbox.setSharedValues([config.gridSizeFromDefinition]);
  }

  /** Stores both typed offsets, or shows the stored ones when one is invalid. */
  private offsetCommit(): void {
    const tool = getStateSprinkleTool();
    const gridOffsetU = this.offsetUInput.parseNumberOrNull();
    const gridOffsetV = this.offsetVInput.parseNumberOrNull();
    if (gridOffsetU === null || gridOffsetV === null) {
      this.configShowCurrent();
      return;
    }
    tool.configPatch({ gridOffsetU, gridOffsetV });
  }

  /**
   * Stores both typed sizes, or shows the stored ones when one is invalid or
   * below the smallest grid size.
   */
  private sizeCommit(): void {
    const tool = getStateSprinkleTool();
    const gridSizeU = this.sizeUInput.parseNumberOrNull();
    const gridSizeV = this.sizeVInput.parseNumberOrNull();
    if (!this.sizeIsValid(gridSizeU) || !this.sizeIsValid(gridSizeV)) {
      this.configShowCurrent();
      return;
    }
    tool.configPatch({ gridSizeU, gridSizeV });
  }

  /**
   * Returns whether a typed size can be stored.
   *
   * @param size Typed size, or null when the field holds no number.
   * @returns True when the size is at least the smallest grid size.
   */
  private sizeIsValid(size: number | null): size is number {
    return size !== null && size >= SPRINKLE_GRID_SIZE_MIN;
  }

  /**
   * Copies the editor grid interval into the size and stops using the
   * definition grid.
   */
  private editorGridApply(): void {
    const interval = this.services.gridIntervalRead();
    if (interval === null || interval < SPRINKLE_GRID_SIZE_MIN) {
      this.services.statusReport('Sprinkle: the editor grid size is not available');
      return;
    }
    getStateSprinkleTool().configPatch({ gridSizeU: interval, gridSizeV: interval, gridSizeFromDefinition: false });
  }

  /**
   * Lists the meter fields.
   *
   * @returns Offset and size fields.
   */
  private fieldsRead(): InputNumeric[] {
    return [this.offsetUInput, this.offsetVInput, this.sizeUInput, this.sizeVInput];
  }
}
