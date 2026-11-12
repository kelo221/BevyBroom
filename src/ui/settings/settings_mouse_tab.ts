import type { EditorSettingsStore } from '@/settings/store/editor_settings_store.js';
import {
  MOUSE_SENSITIVITY_MAX,
  MOUSE_SENSITIVITY_MIN,
  MOUSE_MOVE_SPEED_MAX,
  MOUSE_MOVE_SPEED_MIN,
  type MouseSettings,
} from '@/settings/store/settings_types.js';
import {
  createSettingsCategory,
  createSettingsControlRow,
  createSettingsSelect,
  createSettingsSlider,
} from './settings_form_controls.js';
import { keyboardHintFormat } from '@/settings/keyboard/keyboard_hint_format.js';
import {
  PLATFORM_POINTER_WHEEL_PREFERENCES,
  type PlatformPointerWheelPreference,
} from '@/platform/pointer/platform_pointer_wheel_gesture_map.js';

/** Dropdown labels of the 2D view wheel preferences. */
const MOUSE_WHEEL_PREFERENCE_LABELS: Readonly<Record<PlatformPointerWheelPreference, string>> = Object.freeze({
  auto: 'Automatic (mouse zooms, trackpad pans)',
  zoom: 'Zoom',
  pan: 'Pan (pinch zooms)',
});

/** Mouse navigation preferences for look, pan, and movement. */
export class SettingsMouseTab {
  private readonly root: HTMLElement;
  private readonly store: EditorSettingsStore;

  /**
   * Creates the Mouse tab content.
   *
   * @param store Settings store that persists mouse preferences.
   */
  constructor(store: EditorSettingsStore) {
    this.store = store;
    this.root = document.createElement('div');
    this.root.style.display = 'flex';
    this.root.style.flexDirection = 'column';
    this.rebuild();
  }

  /**
   * Returns the tab root element.
   *
   * @returns Tab content root.
   */
  getElement(): HTMLElement {
    return this.root;
  }

  /** Rebuilds the controls from the current settings snapshot. */
  rebuild(): void {
    const settings = this.store.getMouseSettings();
    this.root.replaceChildren(
      this.buildLookCategory(settings),
      this.buildPanCategory(settings),
      this.buildMoveCategory(settings),
    );
  }

  /**
   * Builds Mouse Look controls.
   *
   * @param settings Current mouse preferences.
   * @returns Look category section.
   */
  private buildLookCategory(settings: MouseSettings): HTMLElement {
    const { section, body } = createSettingsCategory('Mouse Look');
    body.appendChild(this.createSensitivityRow('look-sensitivity', settings.lookSensitivity, 'lookSensitivity'));
    body.appendChild(
      this.createCheckboxRow('Invert X axis', 'look-invert-x-axis', settings.lookInvertXAxis, 'lookInvertXAxis'),
    );
    body.appendChild(
      this.createCheckboxRow('Invert Y axis', 'look-invert-y-axis', settings.lookInvertYAxis, 'lookInvertYAxis'),
    );
    return section;
  }

  /**
   * Builds Mouse Pan controls.
   *
   * @param settings Current mouse preferences.
   * @returns Pan category section.
   */
  private buildPanCategory(settings: MouseSettings): HTMLElement {
    const { section, body } = createSettingsCategory('Mouse Pan');
    body.appendChild(this.createSensitivityRow('pan-sensitivity', settings.panSensitivity, 'panSensitivity'));
    body.appendChild(
      this.createCheckboxRow('Invert X axis', 'pan-invert-x-axis', settings.panInvertXAxis, 'panInvertXAxis'),
    );
    body.appendChild(
      this.createCheckboxRow('Invert Y axis', 'pan-invert-y-axis', settings.panInvertYAxis, 'panInvertYAxis'),
    );
    body.appendChild(this.createWheelPreferenceRow(settings.wheelIn2dViews));
    body.appendChild(
      this.createCheckboxRow(
        keyboardHintFormat('{alt} + left drag acts as middle mouse (pan)'),
        'alt-left-drag-emulates-middle-mouse',
        settings.altLeftDragEmulatesMiddleMouse,
        'altLeftDragEmulatesMiddleMouse',
      ),
    );
    return section;
  }

  /**
   * Creates the dropdown choosing what the wheel does over 2D views.
   *
   * @param value Current wheel preference.
   * @returns Wheel preference control row.
   */
  private createWheelPreferenceRow(value: PlatformPointerWheelPreference): HTMLElement {
    const options = PLATFORM_POINTER_WHEEL_PREFERENCES.map((preference) => ({
      value: preference,
      label: MOUSE_WHEEL_PREFERENCE_LABELS[preference],
    }));
    const select = createSettingsSelect(options, value, (nextValue) =>
      this.store.updateMouseSettings({ wheelIn2dViews: nextValue as PlatformPointerWheelPreference }),
    );
    select.dataset['settingsField'] = 'wheel-in-2d-views';
    return createSettingsControlRow('Wheel in 2D views', select);
  }

  /**
   * Builds Mouse Move controls.
   *
   * @param settings Current mouse preferences.
   * @returns Move category section.
   */
  private buildMoveCategory(settings: MouseSettings): HTMLElement {
    const { section, body } = createSettingsCategory('Mouse Move');
    body.appendChild(this.createSpeedRow(settings.moveSpeed));
    body.appendChild(this.createSensitivityRow('move-sensitivity', settings.moveSensitivity, 'moveSensitivity'));
    body.appendChild(
      this.createCheckboxRow('Invert mouse wheel', 'invert-mouse-wheel', settings.invertMouseWheel, 'invertMouseWheel'),
    );
    body.appendChild(
      this.createCheckboxRow(
        keyboardHintFormat('{alt} + middle mouse drag to move camera'),
        'alt-middle-mouse-drag-moves-camera',
        settings.altMiddleMouseDragMovesCamera,
        'altMiddleMouseDragMovesCamera',
      ),
    );
    body.appendChild(
      this.createCheckboxRow(
        keyboardHintFormat('Invert Z axis in {alt} + middle mouse drag'),
        'invert-alt-middle-mouse-drag-z-axis',
        settings.invertAltMiddleMouseDragZAxis,
        'invertAltMiddleMouseDragZAxis',
      ),
    );
    body.appendChild(
      this.createCheckboxRow(
        'Move camera towards cursor',
        'move-camera-towards-cursor',
        settings.moveCameraTowardsCursor,
        'moveCameraTowardsCursor',
      ),
    );
    return section;
  }

  /**
   * Creates the 3D fly movement speed slider row.
   *
   * @param value Current movement speed.
   * @returns Movement speed control row.
   */
  private createSpeedRow(value: number): HTMLElement {
    const slider = createSettingsSlider(MOUSE_MOVE_SPEED_MIN, MOUSE_MOVE_SPEED_MAX, 1, value, String, (nextValue) =>
      this.store.updateMouseSettings({ moveSpeed: nextValue }),
    );
    const input = slider.querySelector('input') as HTMLInputElement;
    input.dataset['settingsField'] = 'move-speed';
    return createSettingsControlRow('Speed', slider);
  }

  /**
   * Creates one sensitivity slider row.
   *
   * @param fieldId Stable test identifier.
   * @param value Current slider value.
   * @param settingKey Mouse preference updated by the slider.
   * @returns Sensitivity control row.
   */
  private createSensitivityRow(fieldId: string, value: number, settingKey: keyof MouseSettings): HTMLElement {
    const slider = createSettingsSlider(MOUSE_SENSITIVITY_MIN, MOUSE_SENSITIVITY_MAX, 1, value, String, (nextValue) =>
      this.store.updateMouseSettings({ [settingKey]: nextValue }),
    );
    const input = slider.querySelector('input') as HTMLInputElement;
    input.dataset['settingsField'] = fieldId;
    return createSettingsControlRow('Sensitivity', slider);
  }

  /**
   * Creates a boolean preference checkbox row.
   *
   * @param label Label displayed for the preference.
   * @param fieldId Stable test identifier.
   * @param checked Current checked state.
   * @param settingKey Mouse preference updated by the checkbox.
   * @returns Checkbox control row.
   */
  private createCheckboxRow(
    label: string,
    fieldId: string,
    checked: boolean,
    settingKey: keyof MouseSettings,
  ): HTMLElement {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.dataset['settingsField'] = fieldId;
    checkbox.addEventListener('change', () => this.store.updateMouseSettings({ [settingKey]: checkbox.checked }));
    return createSettingsControlRow(label, checkbox);
  }
}
