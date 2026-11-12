import {
  PLATFORM_POINTER_BUTTON_MIDDLE,
  PLATFORM_POINTER_BUTTON_PRIMARY,
  PLATFORM_POINTER_BUTTON_SECONDARY,
  type PlatformPointerButtonMap,
} from '@/platform/pointer/platform_pointer_button_map.js';

/** Button and modifier flags of a primary button press offered to a remap rule. */
export interface PlatformPointerButtonRemapPress {
  readonly button: number;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}

/** Decides whether a mouse press is delivered to the page as another button. */
export abstract class PlatformPointerButtonRemapRule {
  /**
   * Returns the button a press acts as.
   *
   * @param press Button and modifier flags of the press.
   * @returns Button index the press is delivered as, or null to leave the press
   *   alone.
   */
  abstract pressButtonResolve(press: PlatformPointerButtonRemapPress): number | null;
}

/**
 * Delivers the platform's modifier+primary secondary click (Control+click on
 * macOS) as the secondary button.
 */
export class PlatformPointerButtonRemapRuleSecondaryClick extends PlatformPointerButtonRemapRule {
  private readonly buttonMap: PlatformPointerButtonMap;

  /**
   * Creates the rule.
   *
   * @param buttonMap Button map of the platform.
   */
  constructor(buttonMap: PlatformPointerButtonMap) {
    super();
    this.buttonMap = buttonMap;
  }

  /**
   * Returns the secondary button for the platform's secondary click.
   *
   * @param press Button and modifier flags of the press.
   * @returns Secondary button index, or null.
   */
  pressButtonResolve(press: PlatformPointerButtonRemapPress): number | null {
    return this.buttonMap.secondaryButtonPressIs(press) ? PLATFORM_POINTER_BUTTON_SECONDARY : null;
  }
}

/**
 * Delivers Alt (Option) held with the primary button as the middle button, so
 * one-button and two-button mice and trackpads can pan with Alt+drag.
 */
export class PlatformPointerButtonRemapRuleMiddleEmulation extends PlatformPointerButtonRemapRule {
  private readonly isEnabled: () => boolean;

  /**
   * Creates the rule.
   *
   * @param isEnabled Reads whether the user switched the emulation on.
   */
  constructor(isEnabled: () => boolean) {
    super();
    this.isEnabled = isEnabled;
  }

  /**
   * Returns the middle button for Alt+primary while the emulation is on. Alt
   * with Control or Command is left alone so the secondary click and modifier
   * tool clicks keep their meaning.
   *
   * @param press Button and modifier flags of the press.
   * @returns Middle button index, or null.
   */
  pressButtonResolve(press: PlatformPointerButtonRemapPress): number | null {
    if (!this.isEnabled() || press.button !== PLATFORM_POINTER_BUTTON_PRIMARY) {
      return null;
    }
    return press.altKey && !press.ctrlKey && !press.metaKey ? PLATFORM_POINTER_BUTTON_MIDDLE : null;
  }
}
