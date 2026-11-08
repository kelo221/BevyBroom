import { Theme } from '@/theme.js';
import { PanelFloatingToolWindow } from '@/ui/floating_panel/panel_floating_tool_window.js';
import { formLayoutFieldLabelCreate, formLayoutGridCreate, formLayoutRowCreate } from '@/ui/form/form_layout.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { getStateSprinkleDefinitionLibrary } from '@/tools/sprinkle/definition/state_sprinkle_definition_library.js';
import type { SprinkleControls, SprinkleControlsServices } from './controls/sprinkle_controls.js';
import { SprinkleControlsDefinition } from './controls/sprinkle_controls_definition.js';
import { SprinkleControlsPlacement } from './controls/sprinkle_controls_placement.js';
import { SprinkleControlsGrid } from './controls/sprinkle_controls_grid.js';

/** Services of the Entity Sprinkle window. */
export interface DialogSprinkleServices extends SprinkleControlsServices {
  /** Returns the viewport tool to Select. */
  readonly toolSelectExit: () => void;
}

/** Column sizes of the window grid: caption, control and trailing button. */
const DIALOG_SPRINKLE_GRID_COLUMNS = 'auto minmax(0, 1fr) auto';

/**
 * Hammer++ style Entity Sprinkle window: Type, Mode, Density, Grid Offset, Grid
 * Size and the orientation toggles of the Sprinkle tool. Closing it while the
 * Sprinkle tool is active returns the viewport tool to Select.
 */
export class DialogSprinkle extends PanelFloatingToolWindow {
  /** Type list, Refresh, Open Source and notice line. */
  readonly definitionControls: SprinkleControlsDefinition;
  /** Mode, Density and orientation toggles. */
  readonly placementControls = new SprinkleControlsPlacement();
  /** Grid offset and size controls. */
  readonly gridControls: SprinkleControlsGrid;
  private isToolExitOnHideEnabled = true;

  /**
   * Creates the window, hidden.
   *
   * @param host Parent element hosting floating panels.
   * @param services Grid interval, status reporting and tool exit.
   */
  constructor(
    host: HTMLElement,
    private readonly services: DialogSprinkleServices,
  ) {
    super(host, {
      titleText: 'Entity Sprinkle',
      className: 'dialog-sprinkle',
      width: '380px',
      floating: { centered: true, draggable: true, closeOnEscape: true },
    });
    this.definitionControls = new SprinkleControlsDefinition(services);
    this.gridControls = new SprinkleControlsGrid(services);
    this.body.append(this.layoutGridBuild(), this.definitionControls.noticeLine);
    this.listenersBind();
    this.definitionControls.definitionFallbackApply();
    this.controlsShowCurrent();
  }

  /**
   * Opens or closes the window.
   *
   * @param isShown True to open the window.
   */
  visibilityWrite(isShown: boolean): void {
    if (isShown === this.isOpen()) {
      return;
    }
    if (isShown) {
      this.show();
    } else {
      this.hide();
    }
  }

  /** Removes the listeners and the window without changing the viewport tool. */
  override dispose(): void {
    this.isToolExitOnHideEnabled = false;
    super.dispose();
  }

  /**
   * Returns the viewport tool to Select when the window closes while the
   * Sprinkle tool is active.
   */
  protected override onAfterHide(): void {
    if (this.isToolExitOnHideEnabled && getStateSprinkleTool().toolActiveRead()) {
      this.services.toolSelectExit();
    }
  }

  /**
   * Shows configuration and library changes and disposes the controls with the
   * window.
   */
  private listenersBind(): void {
    this.disposerAdd(getStateSprinkleTool().changeListenerAdd(() => this.controlsShowCurrent()));
    this.disposerAdd(getStateSprinkleDefinitionLibrary().changeListenerAdd(() => this.libraryChangeShow()));
    this.disposerAdd(() => this.controlsGroupsRead().forEach((controls) => controls.dispose()));
  }

  /** Keeps a loaded definition chosen and shows the new library contents. */
  private libraryChangeShow(): void {
    this.definitionControls.definitionFallbackApply();
    this.controlsShowCurrent();
  }

  /** Shows the current configuration in every control group. */
  private controlsShowCurrent(): void {
    this.controlsGroupsRead().forEach((controls) => controls.configShowCurrent());
  }

  /**
   * Lists the control groups.
   *
   * @returns Control groups.
   */
  private controlsGroupsRead(): SprinkleControls[] {
    return [this.definitionControls, this.placementControls, this.gridControls];
  }

  /**
   * Builds the caption, control and button grid of the window.
   *
   * @returns Grid element.
   */
  private layoutGridBuild(): HTMLElement {
    const layout = formLayoutGridCreate(DIALOG_SPRINKLE_GRID_COLUMNS, this.layoutCellsRead());
    layout.style.alignItems = 'center';
    layout.style.gap = '4px 6px';
    return layout;
  }

  /**
   * Lists the window grid cells row by row: caption, control, trailing button.
   *
   * @returns Grid cells; null cells stay empty.
   */
  private layoutCellsRead(): (HTMLElement | null)[] {
    const definition = this.definitionControls;
    const placement = this.placementControls;
    const grid = this.gridControls;
    return [
      ...[this.captionCreate('Type:'), definition.typeSelect.getElement(), definition.refreshButton],
      ...[this.captionCreate('Mode:'), placement.modeSelect.getElement(), definition.openSourceButton],
      ...[this.captionCreate('Density:'), placement.densitySlider.getElement(), this.captionCreate('%')],
      ...[this.captionCreate('Grid Offset:'), grid.offsetRow, null],
      ...[this.captionCreate('Grid Size:'), grid.sizeRow, grid.useGridButton],
      ...[null, grid.fromDefinitionLabel, null],
      ...[null, this.togglesRowBuild(), null],
    ];
  }

  /**
   * Builds the row holding Random Yaw and Align to Normal.
   *
   * @returns Row element.
   */
  private togglesRowBuild(): HTMLElement {
    const placement = this.placementControls;
    const togglesRow = formLayoutRowCreate([placement.randomYawLabel, placement.alignToNormalLabel]);
    togglesRow.style.columnGap = '16px';
    return togglesRow;
  }

  /**
   * Creates one caption of the window grid.
   *
   * @param text Caption text.
   * @returns Caption element.
   */
  private captionCreate(text: string): HTMLElement {
    const caption = formLayoutFieldLabelCreate(text, Theme.uiFontFamily);
    caption.style.whiteSpace = 'nowrap';
    return caption;
  }
}
