import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityFieldEditor } from '@/game_entity/ui/fields/game_entity_field_editor.js';
import { gameEntityFieldEditorCreate } from '@/game_entity/ui/fields/game_entity_field_editor_factory.js';
import {
  LIGHT_COOKIE_ASSET_TYPE_PATH,
  LIGHT_COOKIE_MAX_OUTER_DEGREES,
} from '@/light/model/features/light_settings_cookie.js';
import type { LightSettings } from '@/light/model/light_settings.js';
import {
  PanelPropertiesLightGroup,
  type PanelPropertiesLightGroupHost,
} from '@/light/ui/properties/panel_properties_light_group.js';
import { panelPropertiesRowCaptionPaint } from '@/ui/properties/panel_properties_row.js';

/** Asset field the cookie picker edits: an image from the game's assets. */
const LIGHT_COOKIE_FIELD: GameEntityField = {
  path: 'cookie',
  label: 'Light cookie',
  kind: 'asset',
  default: null,
  asset_type: LIGHT_COOKIE_ASSET_TYPE_PATH,
};

/**
 * Texture a spot light projects. The picker lists the images the game reported
 * and falls back to a path field while no game is connected.
 */
export class PanelPropertiesLightGroupCookie extends PanelPropertiesLightGroup {
  private readonly pickerHost: HTMLElement;
  private picker: GameEntityFieldEditor | null;
  private pickerGeneration: number;

  /**
   * Creates the group and its rows.
   *
   * @param host Receives the group's edits.
   */
  constructor(host: PanelPropertiesLightGroupHost) {
    super(host, { title: 'Cookie', iconName: 'image-outline' });
    this.picker = null;
    this.pickerGeneration = -1;
    this.pickerHost = document.createElement('div');
    this.rowAppend('Texture', { getElement: () => this.pickerHost });
    this.pickerEnsure();
    const tooWide = (settings: LightSettings): boolean =>
      settings.cookieTexture !== '' && settings.outerCutoffDegrees > LIGHT_COOKIE_MAX_OUTER_DEGREES;
    this.rowShownWhen(this.hintRowAppend(), (settings) => tooWide(settings));
    this.writerAdd((settingsList) => this.pickerValuesShow(settingsList));
  }

  /**
   * Shows the group for spot lights only.
   *
   * @param settings Light settings.
   * @returns True for spot lights.
   */
  protected override appliesTo(settings: LightSettings): boolean {
    return settings.kind === 'spot';
  }

  /**
   * Shows the bound lights' cookie paths, rebuilding the picker when the game
   * reported other images.
   *
   * @param settingsList Settings of the bound lights.
   */
  private pickerValuesShow(settingsList: readonly LightSettings[]): void {
    const picker = this.pickerEnsure();
    picker.valuesShow(settingsList.map((settings) => (settings.cookieTexture === '' ? null : settings.cookieTexture)));
  }

  /**
   * Returns the picker, building it again when the known images changed.
   *
   * @returns Cookie path picker.
   */
  private pickerEnsure(): GameEntityFieldEditor {
    const generation = GameEntityClassRegistry.generation();
    if (this.picker && this.pickerGeneration === generation) {
      return this.picker;
    }
    const picker = gameEntityFieldEditorCreate(LIGHT_COOKIE_FIELD, true);
    picker.bindCommit((edit) => this.cookieCommit(edit(null)));
    this.pickerHost.replaceChildren(picker.getElement());
    this.picker = picker;
    this.pickerGeneration = generation;
    return picker;
  }

  /**
   * Commits a picked cookie path; anything but a path clears the cookie.
   *
   * @param value Picked value.
   */
  private cookieCommit(value: unknown): void {
    const cookieTexture = typeof value === 'string' ? value : '';
    this.host.settingsCommit((settings) => ({ ...settings, cookieTexture }));
  }

  /**
   * Appends the note shown when the cone is too wide to project a cookie.
   *
   * @returns Hint row element.
   */
  private hintRowAppend(): HTMLElement {
    const hint = document.createElement('span');
    hint.textContent = `Cookies need an outer angle of ${LIGHT_COOKIE_MAX_OUTER_DEGREES}° or less.`;
    panelPropertiesRowCaptionPaint(hint);
    hint.style.opacity = '0.7';
    return this.rowAppend('', { getElement: () => hint });
  }
}
