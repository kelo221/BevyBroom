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
import { lightSettingsRadiusWrite } from '@/light/model/features/light_settings_radius.js';
import { LightVisualBuilder } from '@/light/visual/light_visual_builder.js';
import type { IconName } from '@/ui/icons/icon_name.js';
import type { EntityHandle } from '@/entity/handles/entity_handle.js';
import { LightHandleConeAngle } from '@/light/handles/light_handle_cone_angle.js';
import { LightHandleRadius } from '@/light/handles/light_handle_radius.js';

/** Radius ball shared by every light; handles keep no state. */
const LIGHT_HANDLE_RADIUS = new LightHandleRadius();

/** Cone angle ball shared by every spot light; handles keep no state. */
const LIGHT_HANDLE_CONE_ANGLE = new LightHandleConeAngle();

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
   * Returns true: a light keeps a unit scale and scale edits change its radius.
   *
   * @returns Always true.
   */
  override scaleAbsorbs(): boolean {
    return true;
  }

  /**
   * Returns the settings with the radius, and with it the fog radius,
   * multiplied by the scale factor.
   *
   * @param settings Current light settings.
   * @param factor Positive uniform scale factor.
   * @returns Settings with the scaled radii.
   */
  override scaleAbsorb(settings: LightSettings, factor: number): LightSettings {
    return lightSettingsRadiusWrite(settings, settings.radius * factor);
  }

  /**
   * Returns false: a light box only moves; its radius has its own handle.
   *
   * @returns Always false.
   */
  override boundsResizable(): boolean {
    return false;
  }

  /**
   * Returns the radius ball of every light and, for spot lights, the cone angle
   * ball.
   *
   * @param settings Light settings.
   * @returns Handles, radius first.
   */
  override handlesCreate(settings: LightSettings): EntityHandle<LightSettings>[] {
    if (settings.kind !== 'spot') {
      return [LIGHT_HANDLE_RADIUS];
    }
    return [LIGHT_HANDLE_RADIUS, LIGHT_HANDLE_CONE_ANGLE];
  }

  /**
   * Returns the settings with a partial edit applied. A new radius without a
   * new fog radius changes the fog radius by the same factor.
   *
   * @param settings Current light settings.
   * @param patch Fields to change, not yet validated.
   * @returns Merged settings, not yet validated.
   */
  override settingsPatch(settings: LightSettings, patch: Readonly<Record<string, unknown>>): Record<string, unknown> {
    const radius = patch['radius'];
    const isRadiusOnly = typeof radius === 'number' && !('fogRadius' in patch);
    const base = isRadiusOnly ? lightSettingsRadiusWrite(settings, radius) : settings;
    return { ...base, ...patch };
  }

  /**
   * Returns a light bulb for point lights and a spotlight beam for spot lights.
   *
   * @param settings Light settings.
   * @returns Icon name.
   */
  iconName(settings: LightSettings): IconName {
    return LightVisualBuilder.iconNameOf(settings);
  }

  /**
   * Returns the light color, so the icon shows what the light emits.
   *
   * @param _owner Light owner group.
   * @param settings Light settings.
   * @returns Icon color as a hex number.
   */
  override iconColorHex(_owner: THREE.Object3D, settings: LightSettings): number {
    return settings.colorHex;
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
