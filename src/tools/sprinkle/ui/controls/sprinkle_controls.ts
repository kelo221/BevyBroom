import type { SprinkleConfig } from '@/tools/sprinkle/sprinkle_types.js';
import type { SprinkleDefinition } from '@/tools/sprinkle/definition/sprinkle_definition.js';
import { buttonCompactCreate } from '@/ui/button/button_compact.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { getStateSprinkleDefinitionLibrary } from '@/tools/sprinkle/definition/state_sprinkle_definition_library.js';

/** Height in pixels of the Entity Sprinkle window buttons. */
export const SPRINKLE_CONTROLS_BUTTON_HEIGHT_PX = 22;

/** Minimum fractional digits of the window's meter fields. */
export const SPRINKLE_CONTROLS_METER_DECIMALS = 2;

/** Services the Entity Sprinkle window controls report to. */
export interface SprinkleControlsServices {
  /**
   * Returns the editor's current snap grid interval in meters.
   *
   * @returns Interval, or null when no grid is available.
   */
  readonly gridIntervalRead: () => number | null;
  /**
   * Shows a message in the status bar.
   *
   * @param message Message text.
   */
  readonly statusReport: (message: string) => void;
}

/**
 * One group of Entity Sprinkle window controls. Shows the Sprinkle tool
 * configuration and owns cleanup functions its subclasses register.
 */
export abstract class SprinkleControls {
  private readonly disposers: Array<() => void> = [];

  /**
   * Shows the configuration in the controls.
   *
   * @param config Current Sprinkle tool configuration.
   * @param activeDefinition Definition the configuration names, or null.
   */
  abstract configShow(config: Readonly<SprinkleConfig>, activeDefinition: SprinkleDefinition | null): void;

  /** Shows the current Sprinkle tool configuration and its active definition. */
  configShowCurrent(): void {
    const config = getStateSprinkleTool().configRead();
    this.configShow(config, getStateSprinkleDefinitionLibrary().definitionFind(config.definitionName));
  }

  /** Runs every registered cleanup function once. */
  dispose(): void {
    this.disposers.splice(0).forEach((disposer) => disposer());
  }

  /**
   * Registers a cleanup function run once by dispose.
   *
   * @param disposer Cleanup function, for example a listener removal.
   */
  protected disposerAdd(disposer: () => void): void {
    this.disposers.push(disposer);
  }

  /**
   * Creates one compact text button of the window.
   *
   * @param text Button text.
   * @param title Tooltip and accessible name.
   * @param onClick Click handler.
   * @returns Button element.
   */
  protected buttonCreate(text: string, title: string, onClick: () => void): HTMLButtonElement {
    return buttonCompactCreate({ title, text, widthPx: null, heightPx: SPRINKLE_CONTROLS_BUTTON_HEIGHT_PX, onClick });
  }
}
