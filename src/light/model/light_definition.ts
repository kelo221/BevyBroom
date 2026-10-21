import type * as THREE from 'three';
import { EntityDefinition } from '@/entity/model/entity_definition.js';
import type { EntityKind } from '@/entity/model/entity_owner_keys.js';
import {
  type LightSettings,
  lightSettingsClone,
  lightSettingsCreateDefault,
  lightSettingsFromUnknown,
  lightSettingsSanitize,
} from '@/light/model/light_settings.js';
import { LightVisualBuilder } from '@/light/visual/light_visual_builder.js';

/** Rules of authored lights: point or spot settings and their visuals. */
export class LightDefinition extends EntityDefinition<LightSettings> {
  readonly kind: EntityKind = 'light';

  /**
   * Returns default point light settings.
   *
   * @returns Fresh settings object.
   */
  settingsCreateDefault(): LightSettings {
    return lightSettingsCreateDefault('point');
  }

  /**
   * Returns settings the game renderer accepts.
   *
   * @param settings Possibly invalid settings.
   * @returns Valid settings.
   */
  settingsSanitize(settings: LightSettings): LightSettings {
    return lightSettingsSanitize(settings);
  }

  /**
   * Reads untrusted data into valid light settings.
   *
   * @param value Any value.
   * @returns Valid settings, or null when the value is not an object.
   */
  settingsFromUnknown(value: unknown): LightSettings | null {
    return lightSettingsFromUnknown(value);
  }

  /**
   * Copies light settings.
   *
   * @param settings Source settings.
   * @returns Independent copy.
   */
  override settingsClone(settings: LightSettings): LightSettings {
    return lightSettingsClone(settings);
  }

  /**
   * Rebuilds the marker, range and cone of a light owner.
   *
   * @param owner Light owner group.
   * @param settings Valid settings.
   */
  visualsRefresh(owner: THREE.Object3D, settings: LightSettings): void {
    LightVisualBuilder.refresh(owner, settings);
  }
}
