import type * as THREE from 'three';
import { Theme } from '@/theme.js';
import { styleFloatingPanelChromeButton } from '@/ui/floating_panel/panel_floating_title_bar.js';
import type { ObjectPropertiesTabContext } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { ObjectPropertiesTabSection } from '@/ui/object_properties/tabs/object_properties_tab_section.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { BUTTON_COMPACT_ACTIVE_BACKGROUND } from '@/ui/button/button_compact.js';
import { ObjectPropertiesClassInfoChromePart } from './chrome/object_properties_class_info_chrome_part.js';

/** What the toggle buttons switch. */
export interface ObjectPropertiesClassInfoTogglesHost {
  /** Switches the keyvalue table between field editors and plain text. */
  readonly smartEditWrite: (isSmartEdit: boolean) => void;
  /** Shows or hides the help box. */
  readonly helpVisibleWrite: (isVisible: boolean) => void;
}

/**
 * The SmartEdit and Help toggle buttons of the Class Info tab, both pressed at
 * first.
 */
export class ObjectPropertiesClassInfoSectionToggles extends ObjectPropertiesTabSection {
  /**
   * Creates the pressed toggle buttons.
   *
   * @param context Tab context.
   * @param host Receives the toggled states.
   */
  constructor(context: ObjectPropertiesTabContext, host: ObjectPropertiesClassInfoTogglesHost) {
    super(context, '', new ObjectPropertiesClassInfoChromePart());
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '6px';
    row.append(
      this.toggleCreate('SmartEdit', 'smart-edit', (isPressed) => host.smartEditWrite(isPressed)),
      this.toggleCreate('Help', 'help', (isPressed) => host.helpVisibleWrite(isPressed)),
    );
    this.element.appendChild(row);
  }

  /**
   * Leaves the buttons as they are; they show switches, not object data.
   *
   * @param _objects Edited objects.
   */
  refresh(_objects: readonly THREE.Object3D[]): void {}

  /**
   * Creates one pressed toggle button.
   *
   * @param text Button text.
   * @param action Action name stored on the button for lookups.
   * @param onToggle Receives the new pressed state.
   * @returns Button element.
   */
  private toggleCreate(text: string, action: string, onToggle: (isPressed: boolean) => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.dataset['objectPropertiesAction'] = action;
    styleFloatingPanelChromeButton(button);
    ObjectPropertiesClassInfoSectionToggles.pressedWrite(button, true);
    button.addEventListener('click', () => {
      const isPressed = button.getAttribute('aria-pressed') !== 'true';
      ObjectPropertiesClassInfoSectionToggles.pressedWrite(button, isPressed);
      onToggle(isPressed);
    });
    return button;
  }

  /**
   * Shows a toggle button as pressed or released.
   *
   * @param button Toggle button.
   * @param isPressed True for pressed.
   */
  private static pressedWrite(button: HTMLButtonElement, isPressed: boolean): void {
    button.setAttribute('aria-pressed', String(isPressed));
    button.style.background = isPressed ? BUTTON_COMPACT_ACTIVE_BACKGROUND : hexToRgb(Theme.buttonBackground);
    button.style.borderColor = isPressed ? hexToRgb(Theme.selectionColor) : Theme.inputBorderColor;
  }
}
